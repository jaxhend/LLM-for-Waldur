import datetime

from sqlalchemy import Integer, ForeignKey, String, TIMESTAMP, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base


class Threads(Base):
    __tablename__ = "threads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=func.now())
    url_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    users = relationship("Users", back_populates="threads")
    messages = relationship("Messages", back_populates="threads", cascade="all, delete-orphan")
    runs = relationship("Runs", back_populates="threads", cascade="all, delete-orphan")
