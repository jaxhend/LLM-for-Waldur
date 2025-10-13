from datetime import datetime

from sqlalchemy import Integer, ForeignKey, String, TIMESTAMP, func
from sqlalchemy.dialects.mysql import VARCHAR
from sqlalchemy.orm import mapped_column, relationship, Mapped

from ..base import Base


class Runs(Base):
    __tablename__ = "runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    thread_id: Mapped[int] = mapped_column(Integer, ForeignKey("threads.id"), nullable=False)
    message_id: Mapped[int] = mapped_column(Integer, ForeignKey("messages.id"), nullable=False)
    model_name: Mapped[str] = mapped_column(VARCHAR, nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=func.now())

    threads = relationship("Threads", back_populates="runs")
    users = relationship("Users", back_populates="runs")
    feedback = relationship("Feedback", back_populates="runs", cascade="all, delete-orphan")
    messages = relationship("Messages", back_populates="runs")
