from pydantic import BaseModel, Field


class BetRequest(BaseModel):
    amount: int = Field(..., gt=0)


class TransferRequest(BaseModel):
    to_player_id: str
    amount: int = Field(..., gt=0)
