
from ..redis.redis_runnable import RedisQueueRunnable


def build_chat_chain():
    return RedisQueueRunnable()
