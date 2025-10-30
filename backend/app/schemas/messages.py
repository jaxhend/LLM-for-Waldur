from datetime import datetime

from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    id: int
    thread_id: int
    role: str
    content: str
    dialogue_turn: int
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationTurnCreate(BaseModel):
    """Schema for creating a complete turn (user + assistant messages)."""
    thread_id: int
    conversation_turn: int
    user_message: str
    assistant_response: str


class MessageIdRole(BaseModel):
    id: int
    role: str

    class Config:
        from_attributes = True
