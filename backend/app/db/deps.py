from typing import AsyncGenerator
from .base import SessionLocal


async def get_db() -> AsyncGenerator:
    """
    FastAPI dependency that provides an async database session.
    It automatically closes the session after the request.
    """
    async with SessionLocal() as session:
        yield session
