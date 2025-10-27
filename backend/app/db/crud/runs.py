from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Runs


async def create_run(db: AsyncSession, run_data: dict) -> Runs:
    """
    Create a new Run entry in the database.
    """
    result = await db.execute(
        insert(Runs).values(**run_data).returning(Runs))
    run = result.scalar_one()
    await db.commit()
    return run


async def list_runs(db: AsyncSession, message_id: int):
    """
    Retrieve all Run entries from the database.
    """
    q = select(Runs).where(Runs.message_id == message_id).order_by(Runs.id.desc())
    result = await db.execute(q)
    return result.scalars().all()
