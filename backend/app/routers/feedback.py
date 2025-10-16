import structlog
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.deps import get_db
from ..db.models import Messages, Feedback
from ..schemas.feedback import FeedbackOutput, FeedbackCreate

logger = structlog.get_logger()

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("/submit", response_model=FeedbackOutput, status_code=201)
async def create_feedback(feedback: FeedbackCreate, db: AsyncSession = Depends(get_db)):
    """
    Endpoint to receive user feedback on model responses.
    """
    # Verify message_id exists
    res = await db.execute(select(Messages.id).where(Messages.id == feedback.message_id))
    if res.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="message_id not found")

    fb = Feedback(
        message_id=feedback.message_id,
        rating=feedback.rating,
        comment=feedback.comment
    )
    db.add(fb)
    await db.commit()
    await db.refresh(fb)

    logger.info("feedback.created", id=fb.id, message_id=fb.message_id, rating=fb.rating)

    return fb
