from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    username = Column(String(50), nullable=False)
    chips = Column(Integer, nullable=False)
    player_token = Column(String, nullable=False, unique=True)
    is_active = Column(Boolean, nullable=False, default=True)
    joined_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    room = relationship("Room", back_populates="players")
    __table_args__ = (
        UniqueConstraint("room_id", "username", name="uq_room_username"),
    )
