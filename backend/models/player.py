from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.database import Base


class Player(Base):
    __tablename__ = "players"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    invited_username = Column(String(50), nullable=True)
    username = Column(String(50), nullable=False)
    chips = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    seat = Column(Integer, nullable=True)
    total_buyin = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="online")  # online / afk / sitout

    # Per-hand state
    round_bet = Column(Integer, nullable=False, default=0)
    hand_bet = Column(Integer, nullable=False, default=0)
    is_folded = Column(Boolean, nullable=False, default=False)

    joined_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    room = relationship("Room", back_populates="players")
    user = relationship("User", back_populates="players")

    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_room_user"),
    )
