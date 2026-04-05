from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship

from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    user_token = Column(String, unique=True, nullable=False, default=lambda: str(uuid4()))
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    players = relationship("Player", back_populates="user")
