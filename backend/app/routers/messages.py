from typing import List

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


from ..db.deps import get_db
from ..db.models import Threads, Messages
from ..schemas.messages import ConversationTurnCreate, MessageResponse

logger = structlog.get_logger()

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.post("/turn", response_model=List[MessageResponse], status_code=201)
async def create_conversation_turn(
        turn_data: ConversationTurnCreate,
        db: AsyncSession = Depends(get_db)
):
    """
    Create a complete conversation turn (user message + assistant response).
    Both messages will have the same turn number and saved as separate rows.
    """
    try:
        # Verify thread exists
        thread_result = await db.execute(
            select(Threads).where(Threads.id == turn_data.thread_id)
        )
        thread = thread_result.scalar_one_or_none()

        if not thread:
            raise HTTPException(
                status_code=404,
                detail=f"Thread ID {turn_data.thread_id} not found"
            )


        # Create user message
        user_msg = Messages(
            thread_id=turn_data.thread_id,
            role="user",
            content=turn_data.user_message,
            turn=turn_data.turn
        )

        # Create assistant message
        assistant_response = Messages(
            thread_id=turn_data.thread_id,
            role="assistant",
            content=turn_data.assistant_response,
            turn=turn_data.turn
        )

        db.add(user_msg)
        db.add(assistant_response)
        await db.commit()

        await db.refresh(user_msg)
        await db.refresh(assistant_response)

        logger.info(
            "thread_turn.created",
            thread_id=turn_data.thread_id,
            turn=turn_data.turn,
            user_message_id=user_msg.id,
            assistant_message_id=assistant_response.id
        )

        return [user_msg, assistant_response]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("thread_turn.creation_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to create thread turn"
        )


@router.get("/thread/{thread_id}", response_model=List[MessageResponse])
async def get_messages_by_thread(
        thread_id: int,
        db: AsyncSession = Depends(get_db)
):
    """
    Get all messages for a specific thread, ordered by id.
    """
    try:
        result = await db.execute(
            select(Messages)
            .where(Messages.thread_id == thread_id)
            .order_by(Messages.id)
        )
        messages = result.scalars().all()

        return messages

    except Exception as e:
        logger.error("message.get_by_thread_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve messages"
        )


@router.get("/thread/{thread_id}/turn/{turn}", response_model=List[MessageResponse])
async def get_messages_by_turn(
        thread_id: int,
        turn: int,
        db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(
            select(Messages)
            .where(Messages.thread_id == thread_id, Messages.turn == turn)
            .order_by(Messages.id)
        )
        messages = result.scalars().all()

        if not messages:
            raise HTTPException(
                status_code=404,
                detail=f"No messages found for thread ID {thread_id}, turn {turn}"
            )

        return messages

    except HTTPException:
        raise
    except Exception as e:
        logger.error("message.get_by_turn_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve messages"
        )

@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
        message_id: int,
        db: AsyncSession = Depends(get_db)
):
    """
    Get a single message by ID.
    """
    try:
        result = await db.execute(
            select(Messages).where(Messages.id == message_id)
        )
        message = result.scalar_one_or_none()

        if not message:
            raise HTTPException(
                status_code=404,
                detail=f"Message with ID {message_id} not found"
            )

        return message

    except HTTPException:
        raise
    except Exception as e:
        logger.error("message.get_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve message"
        )
