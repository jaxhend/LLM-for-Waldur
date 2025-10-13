import asyncio

# Ensure models are imported so that they are registered with Base. NOTE: don't remove this line
from ...db import models
from ..base import engine, Base


async def init_db():
    print("Initializing DB...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all) # LOCAL ONLY
        await conn.run_sync(Base.metadata.create_all)
    print("DB initialized successfully")


if __name__ == "__main__":
    asyncio.run(init_db())
