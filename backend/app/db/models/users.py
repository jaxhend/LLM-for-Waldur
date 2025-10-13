import datetime

from sqlalchemy import Integer, String, TIMESTAMP, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base


class Users(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=func.now())

    accounts = relationship("Accounts", back_populates="users")
    threads = relationship("Threads", back_populates="users", cascade="all, delete-orphan")
    runs = relationship("Runs", back_populates="users", cascade="all, delete-orphan")
    feedback = relationship("Feedback", back_populates="users", cascade="all, delete-orphan")
