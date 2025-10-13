from datetime import datetime

from sqlalchemy import Integer, ForeignKey, String, TIMESTAMP, func
from sqlalchemy.orm import mapped_column, Mapped, relationship

from ..base import Base


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    run_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("runs.id", ondelete="SET NULL"), nullable=True)
    message_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    users = relationship("Users", back_populates="feedback")
    runs = relationship("Runs", back_populates="feedback")
    messages = relationship("Messages", back_populates="feedback")
