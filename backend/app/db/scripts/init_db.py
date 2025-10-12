import asyncio

# Ensure models are imported so that they are registered with Base. NOTE: don't remove this line
from ..models import accounts
from ..models import conversations
from ..models import feedback
from ..models import messages
from ..models import runs
from ..models import users
from ..base import engine, Base


async def init_db():
    print("Initializing DB...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("DB initialized successfully")


if __name__ == "__main__":
    asyncio.run(init_db())
