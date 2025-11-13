from datetime import datetime

from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    id: str
    thread_id: str
    role: str
    content: str
    conversation_turn: int
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationTurnCreate(BaseModel):
    """Schema for creating a complete turn (user + assistant messages)."""
    thread_id: str
    conversation_turn: int
    user_message: str
    assistant_response: str


class MessageIdRole(BaseModel):
    id: str
    role: str

    class Config:
        from_attributes = True
