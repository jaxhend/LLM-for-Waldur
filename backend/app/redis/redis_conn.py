import os

from redis.asyncio import Redis

from ..config import settings

_redis: Redis | None = None

def get_redis() -> Redis:
    global _redis
    if _redis is None:
        host = settings.redis_host
        port = settings.redis_port
        pwd = settings.redis_password or None
        db = settings.redis_db
        _redis = Redis(host=host, port=port, password=pwd, db=db, decode_responses=True)
    return _redis

async def close_redis():
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None