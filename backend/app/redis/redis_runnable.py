import asyncio
import json
import uuid
from typing import AsyncIterator, Any, Dict, Iterator

from langchain_core.messages import AIMessageChunk, AIMessage
from langchain_core.runnables import Runnable

from ..config import settings
from ..redis.redis_conn import get_redis

QUEUE = settings.redis_queue

class RedisQueueRunnable(Runnable):
    """
        Sends a job to Redis LIST (RPUSH) and streams back results
        from Pub/Sub channel: ollama:result:{job_id}

        Expected worker messages (JSON on Pub/Sub):
          {"type":"chunk","content":"..."}       -> streamed token(s)
          {"type":"metadata","usage":{...}}      -> optional usage/token counts
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
                    yield AIMessageChunk(content="", additional_kwargs={"usage_metadata": md})
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

# ------------------- Async interfaces LangServe uses -------------------
    async def astream(self, input: str, config: Dict[str,Any] | None = None):
        # 1) Enqueue
        job_id = str(uuid.uuid4())
        payload = {
            "id": job_id,
            "input": input,
            "config": (config or {}).get("configurable", {}),
        }
        redis = get_redis()
        await redis.rpush(QUEUE, json.dumps(payload))

        # 2) Stream results back
        async for chunk in self._stream_from_pubsub(job_id):
            yield chunk

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
