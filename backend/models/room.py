from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.orm import relationship

from backend.database import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    room_code = Column(String(6), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    admin_token = Column(String, nullable=False)
    initial_chips = Column(Integer, nullable=False, default=1000)
    small_blind = Column(Integer, nullable=False, default=5)
    big_blind = Column(Integer, nullable=False, default=10)
    status = Column(String(20), nullable=False, default="active")
    current_round = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    players = relationship("Player", back_populates="room", lazy="selectin")
    transactions = relationship("Transaction", back_populates="room", order_by="Transaction.created_at.desc()", lazy="dynamic")
