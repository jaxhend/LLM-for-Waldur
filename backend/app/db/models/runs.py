from datetime import datetime
from sqlalchemy import Integer, ForeignKey, String, TIMESTAMP, func
from sqlalchemy.dialects.mysql import VARCHAR
from sqlalchemy.orm import mapped_column, relationship, Mapped

from ..base import Base


class Runs(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    thread_id: Mapped[str] = mapped_column(String(36), ForeignKey("threads.id", ondelete="CASCADE"), nullable=False)
    conversation_turn: Mapped[int] = mapped_column(Integer, nullable=False)
    model_name: Mapped[str] = mapped_column(VARCHAR, nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=func.now())

    threads = relationship("Threads", back_populates="runs")
