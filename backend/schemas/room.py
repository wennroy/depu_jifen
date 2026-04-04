from pydantic import BaseModel, Field


class CreateRoomRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    admin_username: str = Field(..., min_length=1, max_length=50)
    initial_chips: int = Field(default=1000, ge=100, le=1000000)
    small_blind: int = Field(default=5, ge=1)
    big_blind: int = Field(default=10, ge=1)


class CreateRoomResponse(BaseModel):
    room_id: str
    room_code: str
    admin_token: str
    player_id: str
    player_token: str
    share_link: str


class JoinRoomRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)


class JoinRoomResponse(BaseModel):
    player_id: str
    player_token: str
    chips: int
    room_name: str
    seat: int | None = None


class RoomInfoResponse(BaseModel):
    room_code: str
    name: str
    player_count: int
    status: str
    initial_chips: int


class PlayerState(BaseModel):
    player_id: str
    username: str
    chips: int
    is_active: bool
    seat: int | None = None
    total_buyin: int = 0
    is_preassigned: bool = False
    round_bet: int = 0
    hand_bet: int = 0
    is_folded: bool = False
    is_away: bool = False


class TransactionLog(BaseModel):
    id: int
    tx_type: str
    from_username: str | None
    to_username: str | None
    amount: int
    note: str | None
    created_at: str


class RoomStateResponse(BaseModel):
    room_code: str
    room_name: str
    current_round: int
    status: str
    small_blind: int
    big_blind: int
    game_phase: str
    dealer_seat: int | None
    action_seat: int | None
    pot: int
    current_bet_level: int
    players: list[PlayerState]
    transactions: list[TransactionLog]
    my_player_id: str


# Game actions
class PlayerActionRequest(BaseModel):
    target_player_id: str
    action: str = Field(..., pattern="^(call|fold|raise|allin)$")
    amount: int = Field(default=0, ge=0)


class SettleHandRequest(BaseModel):
    winners: list[dict]  # [{player_id: str, amount: int}]


class SetAwayRequest(BaseModel):
    player_id: str
    away: bool


# Room management (no admin restriction)
class PreassignPlayerRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    seat: int = Field(..., ge=1, le=10)
    chips: int | None = None


class UpdateBlindsRequest(BaseModel):
    small_blind: int = Field(..., ge=1)
    big_blind: int = Field(..., ge=1)


class RebuyRequest(BaseModel):
    amount: int = Field(..., gt=0)


class SeatAssignment(BaseModel):
    player_id: str
    seat: int = Field(..., ge=1, le=10)


class UpdateSeatsRequest(BaseModel):
    assignments: list[SeatAssignment]


class BetRequest(BaseModel):
    amount: int = Field(..., gt=0)


class TransferRequest(BaseModel):
    to_player_id: str
    amount: int = Field(..., gt=0)


class AdjustRequest(BaseModel):
    player_id: str
    amount: int
    note: str = ""


class KickRequest(BaseModel):
    player_id: str
