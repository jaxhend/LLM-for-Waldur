import asyncio
import json
import os

import httpx
import structlog
from redis.asyncio import Redis

from ..redis.redis_conn import get_redis
from ..config import settings

QUEUE = settings.redis_queue

OLLAMA_URL = settings.ollama_base_url  # e.g. "http://127.0.0.1:11434"
OLLAMA_MODEL = settings.ollama_model  # e.g. "llama3.2:1b"

DEBUG = os.getenv("WALDUR_WORKER_DEBUG", "0") == "1"  # For testing locally
logger = structlog.get_logger(__name__)
WORKER_ID = os.getenv("WORKER_ID", f"pid-{os.getpid()}")

# Allowed options + desired type.
# NOTE: Not in use currently, but could be extended.
_OPTION_TYPES = {
    "temperature": float,
    "top_p": float,
    "top_k": int,
    "seed": int,
    "num_ctx": int,
    "num_predict": int,
    "repeat_penalty": float,
}


def _coerce_option_value(key: str, value):
    """Try to coerce strings like '0.2' -> 0.2 for float keys, etc."""
    typ = _OPTION_TYPES.get(key)
    if typ is None or value is None:
        return value
    try:
        # ints must not be cast from floats like '3.5' -> ValueError (which is good)
        if typ is int and isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
        if typ is float and isinstance(value, str):
            return float(value.strip())
        # already correct type
        if isinstance(value, typ):
            return value
    except Exception:
        pass
    return value  # fall back as-is; Ollama may still reject


def _extract_messages_and_options(job: dict) -> tuple[list[dict], dict]:
    """
    Keep it simple for now: always wrap LangServe's input string into a single-user message.
    """
    messages = [{"role": "user", "content": job.get("input", "")}]
    cfg = (job.get("config") or {})
    options = {}
    for k in _OPTION_TYPES.keys():
        if k in cfg and cfg[k] is not None:
            options[k] = _coerce_option_value(k, cfg[k])
    return messages, options


async def stream_ollama_chat(messages: list[dict], options: dict | None = None):
    if not OLLAMA_MODEL:
        raise RuntimeError("settings.ollama_model is not set")

    payload = {
        "model": OLLAMA_MODEL,
        "stream": True,
        "messages": messages,
    }
    if options:
        payload["options"] = options

    if DEBUG:
        print("[OLLAMA /api/chat PAYLOAD]", json.dumps(payload, ensure_ascii=False))

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=payload) as resp:
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as he:
                # Read response body for better error (Ollama explains what's wrong)
                err_text = he.response.text
                raise httpx.HTTPStatusError(
                    f"Ollama HTTP {he.response.status_code}: {err_text}",
                    request=he.request,
                    response=he.response
                ) from None

            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    # tolerate split/partial lines
                    pass


async def main():
    r = get_redis()
    await r.ping()
    while True:
        _, job_json = await r.blpop(QUEUE, timeout=0)
        job = json.loads(job_json)
        job_id = job["id"]
        prompt = job.get("input", "")
        channel = f"ollama:result:{job_id}"

        # Announce which worker took the job (ignored by Runnable). Used for local dev
        await r.publish(channel, json.dumps({"type": "worker", "worker_id": WORKER_ID}))

        logger.info("worker.job.received", worker_id=WORKER_ID, job_id=job_id, queue=QUEUE, preview=prompt[:120])

        try:
            messages, options = _extract_messages_and_options(job)

            # quick guardrails to avoid 400s
            if not messages or not isinstance(messages, list):
                raise ValueError("No messages constructed for Ollama.")
            if not isinstance(messages[0].get("content", ""), str):
                raise ValueError("Message content must be a string.")
            if any("role" not in m or "content" not in m for m in messages):
                raise ValueError("Each message must include role and content.")

            usage = {}
            async for ev in stream_ollama_chat(messages, options):
                if ev.get("done"):
                    # Token usage (when provided)
                    if "prompt_eval_count" in ev:
                        usage["input_tokens"] = ev["prompt_eval_count"]
                    if "eval_count" in ev:
                        usage["output_tokens"] = ev["eval_count"]

                    resp_md = {
                        "model": ev.get("model"),
                        "created_at": ev.get("created_at"),
                        "done_reason": ev.get("done_reason"),
                    }
                    meta = {"type": "metadata"}
                    if usage:
                        meta["usage"] = usage
                    resp_md = {k: v for k, v in resp_md.items() if v is not None}
                    if resp_md:
                        meta["response_metadata"] = resp_md
                    await r.publish(channel, json.dumps(meta))
                    break

                # Streamed delta (chat) or fallback to generate-style
                delta = (ev.get("message") or {}).get("content") or ev.get("response")
                if delta:
                    await r.publish(channel, json.dumps({"type": "chunk", "content": delta}))

        except httpx.HTTPStatusError as he:
            await r.publish(channel, json.dumps({"type": "error", "message": str(he)}))
        except Exception as e:
            await r.publish(channel, json.dumps({"type": "error", "message": str(e)}))
        finally:
            await r.publish(channel, json.dumps({"type": "end"}))


if __name__ == "__main__":
    asyncio.run(main())
