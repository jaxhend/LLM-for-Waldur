from datetime import datetime

from pydantic import BaseModel, conint


class FeedbackCreate(BaseModel):
    message_id: int
    comment: str
    rating: conint(ge=1, le=10)  # Rating between 1 and 10


class FeedbackOutput(BaseModel):
    id: int
    message_id: int
    comment: str | None
    rating: int
    created_at: datetime

    class Config:
        from_attributes = True
