from datetime import datetime

from pydantic import BaseModel


class RunBase(BaseModel):
    message_id: int
    model_name: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_cents: float


class RunCreate(RunBase):
    pass


class RunRead(RunBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
