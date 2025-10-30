from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Runs


async def create_run(db: AsyncSession, run_data: dict) -> Runs:
    """
    Create a new Run entry in the database.
    """

    run = Runs(**run_data)
    db.add(run)
    try:
        await db.flush()
        await db.refresh(run)
        await db.commit()
        return run
    except IntegrityError as e:
        await db.rollback()
        raise e


async def list_runs(db: AsyncSession, thread_id: int):
    """
    Retrieve all Run entries from the database.
    """
    q = select(Runs).where(Runs.thread_id == thread_id).order_by(Runs.id.desc())
    result = await db.execute(q)
    return result.scalars().all()
