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
    players: list[PlayerState]
    transactions: list[TransactionLog]
    is_admin: bool
    my_player_id: str


# Admin pre-assign players
class PreassignPlayerRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    seat: int = Field(..., ge=1, le=10)
    chips: int | None = None  # None = use room default


class UpdateBlindsRequest(BaseModel):
    small_blind: int = Field(..., ge=1)
    big_blind: int = Field(..., ge=1)


class RebuyRequest(BaseModel):
    amount: int = Field(..., gt=0)
