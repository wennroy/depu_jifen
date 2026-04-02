from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from backend.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    round_number = Column(Integer, nullable=True)
    tx_type = Column(String(20), nullable=False)
    from_player_id = Column(String, ForeignKey("players.id"), nullable=True)
    to_player_id = Column(String, ForeignKey("players.id"), nullable=True)
    amount = Column(Integer, nullable=False)
    note = Column(String(200), nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    room = relationship("Room", back_populates="transactions")
    from_player = relationship("Player", foreign_keys=[from_player_id])
    to_player = relationship("Player", foreign_keys=[to_player_id])
