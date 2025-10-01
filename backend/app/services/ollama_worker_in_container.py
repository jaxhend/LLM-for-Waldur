# Ollama must be running!
# Sample code:

import asyncio
import json
import os
import uuid

from redis.asyncio import Redis
from ollama import AsyncClient
import structlog

# ---------------- Config ----------------
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
QUEUE      = os.getenv("REDIS_QUEUE", "ollama_queue")

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3")
DEBUG = os.getenv("DEBUG", "0") == "1"

logger = structlog.get_logger(__name__)
WORKER_ID = os.getenv("WORKER_ID", f"pid-{os.getpid()}")

# ---------------- Helper ----------------
async def stream_ollama(prompt: str):
    """Voogedasta vastus Ollama AsyncClient'iga"""
    async with AsyncClient() as client:
        async for part in await client.chat(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            stream=True
        ):
            delta = part.get("message", {}).get("content")
            if delta:
                yield delta

# ---------------- Main worker loop ----------------
async def main():
    redis = Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    logger.info("Worker ready, listening Redis queue...")

    while True:
        # BLPOP võtab töö queue'st, ootab kuni mõni töö saabub
        _, job_json = await redis.blpop(QUEUE, timeout=0)
        job = json.loads(job_json)
        job_id = job.get("id", str(uuid.uuid4()))
        prompt = job.get("input", "")
        channel = f"ollama:result:{job_id}"

        logger.info("Job received", job_id=job_id, preview=prompt[:50])

        try:
            # Stream response back to Redis channel
            async for chunk in stream_ollama(prompt):
                await redis.publish(channel, json.dumps({"type": "chunk", "content": chunk}))

            # Lõpetus event
            await redis.publish(channel, json.dumps({"type": "end"}))
            logger.info("Job finished", job_id=job_id)

        except Exception as e:
            await redis.publish(channel, json.dumps({"type": "error", "message": str(e)}))
            logger.error("Job error", job_id=job_id, error=str(e))

if __name__ == "__main__":
    asyncio.run(main())
