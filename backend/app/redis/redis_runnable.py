import asyncio
import json
import uuid
from typing import AsyncIterator, Any, Dict, Iterator

from langchain_core.messages import AIMessageChunk, AIMessage
from langchain_core.runnables import Runnable
from sqlalchemy import select, func

from ..config import settings
from ..db.crud.runs import create_run
from ..db.deps import get_db
from ..db.models import Threads, Messages
from ..redis.redis_conn import get_redis
from ..routers.messages import create_conversation_turn, logger
from ..schemas.messages import ConversationTurnCreate

CTX_TTL_SECONDS = 300  # 5 minutes
MAX_CTX_MESSAGES = 20


def clean_ctx(messages: list[dict]) -> list[dict]:
    """
    Cleans the context messages by removing any unnecessary fields.
    """
    out: list[dict] = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role")
        if role not in ("user", "assistant"):
            continue
        content = msg.get("content")
        if not isinstance(content, str):
            content = "" if content is None else str(content)
        content = content.strip()
        if not content:
            continue
        out.append({"role": role, "content": content})

        if len(out) > MAX_CTX_MESSAGES:
            out = out[-MAX_CTX_MESSAGES:]
    return out


class RedisQueueRunnable(Runnable):
    """
        Sends a job to Redis LIST (RPUSH) and streams back results
        from Pub/Sub channel: ollama:result:{job_id}

        Also logs conversations to database when db session is provided in config.
        Expected worker messages (JSON on Pub/Sub):
          {"type":"chunk","content":"..."}       -> streamed token(s)
          {"type":"metadata","usage":{...}, "response_metadata": {"model": "..."}}      -> optional usage/token counts
          {"type":"error","message":"..."}       -> raises
          {"type":"end"}                         -> completes
    """

    async def _stream_from_pubsub(self, job_id: str) -> AsyncIterator[AIMessageChunk]:
        redis = get_redis()
        channel = f"ollama:result:{job_id}"
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel)
        try:
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=30.0)
                if not msg:
                    await asyncio.sleep(0.05)
                    continue
                data = json.loads(msg["data"])
                t = data.get("type")

                if t == "chunk":
                    # Forward as LangChain chunk
                    yield AIMessageChunk(content=data.get("content", ""))
                elif t == "metadata":
                    md = data.get("usage", {})
                    yield AIMessageChunk(
                        content="",
                        additional_kwargs={
                            "usage_metadata": md,
                            "model_name": data.get("response_metadata", {}).get("model")})
                elif t == "error":
                    raise RuntimeError(data.get("message", "Worker error"))
                elif t == "end":
                    break
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except Exception:
                pass
            await pubsub.close()

    async def ensure_thread_and_turn(
            self,
            db,
            configurable: Dict[str, Any] | None
    ) -> tuple[int, int]:
        """
        Returns (thread_id, next_turn). If thread_id is not provided or invalid, creates a new thread.
        """
        cfg = configurable or {}
        thread_id = cfg.get("thread_id")
        user_id = cfg.get("user_id")

        if thread_id is not None:
            res = await db.execute(select(Threads.id).where(Threads.id == thread_id))
            if res.scalar_one_or_none() is None:
                thread_id = None

        if thread_id is None:
            t = Threads(user_id=user_id)
            db.add(t)
            await db.commit()
            await db.refresh(t)
            thread_id = t.id

        q = await db.execute(
            select(func.max(Messages.conversation_turn)).where(Messages.thread_id == thread_id)
        )
        max_conversation_turn = q.scalar() or 0
        next_conversation_turn = max_conversation_turn + 1
        return thread_id, next_conversation_turn

    # ------------------- Async interfaces LangServe uses -------------------
    async def astream(self, input: str, config: Dict[str, Any] | None = None):
        if not isinstance(input, str):
            raise TypeError("input must be a string")

        # Extract DB logging config
        configurable = (config or {}).get("configurable", {})

        db_gen = get_db()
        db = await anext(db_gen)
        try:
            thread_id, conversation_turn = await self.ensure_thread_and_turn(db, configurable)

            redis = get_redis()
            ctx_key = f"chat:ctx:{thread_id}"

            context_messages: list[dict] = []
            cached = await redis.get(ctx_key)
            if cached:
                try:
                    context_messages = json.loads(cached)
                except Exception:
                    context_messages = []

            if not context_messages:
                res = await db.execute(
                    select(Messages)
                    .where(Messages.thread_id == thread_id)
                    .order_by(Messages.id.desc())
                    .limit(MAX_CTX_MESSAGES)
                )
                rows = list(reversed(res.scalars().all()))
                context_messages = [{"role": m.role, "content": m.content} for m in rows]

            context_messages = clean_ctx(context_messages)

            # 1) Enqueue
            user_text = input
            job_id = str(uuid.uuid4())
            payload = {
                "id": job_id,
                "input": user_text,
                "context": context_messages,
                "config": configurable
            }

            await redis.rpush(settings.redis_queue, json.dumps(payload))

            # 2) Stream results and collect response
            collected_response: list[str] = []
            usage_meta: Dict[str, Any] = {}
            usage_model_name: str | None = None

            async for chunk in self._stream_from_pubsub(job_id):
                if isinstance(chunk, AIMessageChunk):
                    if chunk.content:
                        collected_response.append(chunk.content)

                    usage = (chunk.additional_kwargs or {}).get("usage_metadata")
                    if isinstance(usage, dict):
                        usage_meta.update(usage)

                    model_from_chunk = (chunk.additional_kwargs or {}).get("model_name")
                    if model_from_chunk and not usage_model_name:
                        usage_model_name = str(model_from_chunk)
                yield chunk

            # 3) Save to DB after streaming completes

            try:
                conversation_turn_in = ConversationTurnCreate(
                    thread_id=thread_id,
                    conversation_turn=conversation_turn,
                    user_message=input,
                    assistant_response="".join(collected_response)
                )

                created_msgs = await create_conversation_turn(
                    turn_data=conversation_turn_in,
                    db=db
                )

                input_tokens = int(
                    usage_meta.get("input_tokens")
                )
                output_tokens = int(
                    usage_meta.get("output_tokens")
                )

                model_name = usage_model_name or configurable.get("model_name", "unknown")

                runs = []
                assistant_msg_id = None
                for msg in created_msgs:
                    if getattr(msg, "role", "") == "assistant":
                        assistant_msg_id = msg.id
                        run_data = {
                            "thread_id": thread_id,
                            "conversation_turn": conversation_turn,
                            "model_name": model_name,
                            "input_tokens": input_tokens,
                            "output_tokens": output_tokens
                        }
                        created_run = await create_run(db, run_data)
                        runs.append(created_run)
                        break

                logger.info("runs.created", thread_id=thread_id, conversation_turn=conversation_turn, job_id=job_id,
                            run_ids=[run.id for run in runs]
                            )

                assistant_text = "".join(collected_response)
                if user_text:
                    context_messages.append({"role": "user", "content": user_text})
                if assistant_text:
                    context_messages.append({"role": "assistant", "content": assistant_text})
                context_messages = clean_ctx(context_messages)
                await redis.setex(ctx_key, CTX_TTL_SECONDS, json.dumps(context_messages))

                if assistant_msg_id is not None:
                    yield AIMessageChunk(
                        content="",
                        additional_kwargs={
                            "event": "metadata",
                            "thread_id": thread_id,
                            "conversation_turn": conversation_turn,
                            "message_id": assistant_msg_id,
                        }
                    )
                    logger.info("thread_turn.completed", thread_id=thread_id, conversation_turn=conversation_turn,
                                assistant_message_id=assistant_msg_id)

            except Exception as e:
                # Log error but don't fail the whole request if DB logging fails
                logger.warning("runs.creation_failed", error=str(e), thread_id=thread_id, conversation_turn=conversation_turn,
                               job_id=job_id)
        finally:
            try:
                await db_gen.aclose()
            except Exception:
                pass

    async def ainvoke(self, input: str, config: Dict[str, Any] | None = None) -> AIMessage:

        parts: list[str] = []
        usage_agg: Dict[str, int] = {}
        response_md: dict[str, Any] = {}
        async for chunk in self.astream(input, config=config):
            if isinstance(chunk, AIMessageChunk):
                if chunk.content:
                    parts.append(chunk.content)

                usage = (chunk.additional_kwargs or {}).get("usage_metadata")
                if isinstance(usage, dict):
                    usage_agg.update(usage)

                if chunk.response_metadata:
                    response_md.update(chunk.response_metadata)
            else:
                parts.append(str(chunk))
        return AIMessage(
            content="".join(parts),
            additional_kwargs=({"usage_metadata": usage_agg} if usage_agg else {}),
            response_metadata=response_md
        )

    # ------------------- Sync wrappers to satisfy Runnable abstract methods -------------------
    def invoke(self, input: str, config: Dict[str, Any] | None = None) -> AIMessage:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(self.ainvoke(input, config=config))

        # already in event loop (FastAPI context) -> tell caller to use async
        raise RuntimeError("Synchronous invoke not supported inside an active event loop. Use ainvoke().")

    def stream(self, input: str, config: Dict[str, Any] | None = None) -> Iterator[AIMessageChunk]:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            async def _collect():
                out = []
                async for c in self.astream(input, config=config):
                    out.append(c)
                return out

            for c in asyncio.run(_collect()):
                yield c
            return
        raise RuntimeError("Synchronous stream not supported inside an active event loop. Use astream().")
