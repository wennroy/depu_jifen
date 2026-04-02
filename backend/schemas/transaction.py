from pydantic import BaseModel, Field


class SettlementItem(BaseModel):
    player_id: str
    delta: int


class SettleRequest(BaseModel):
    settlements: list[SettlementItem] = Field(..., min_length=1)


class AdjustRequest(BaseModel):
    player_id: str
    amount: int
    note: str = ""


class KickRequest(BaseModel):
    player_id: str
