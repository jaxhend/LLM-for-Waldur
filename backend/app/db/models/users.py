import datetime
import uuid

from sqlalchemy import Integer, String, TIMESTAMP, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..base import Base


class Users(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("accounts.id"), nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), default=func.now())

    accounts = relationship("Accounts", back_populates="users")
    threads = relationship("Threads", back_populates="users", cascade="all, delete-orphan")

