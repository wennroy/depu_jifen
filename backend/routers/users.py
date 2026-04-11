from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, Player, Room

router = APIRouter(prefix="/api/users", tags=["users"])


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)


class UserResponse(BaseModel):
    user_id: str
    username: str
    user_token: str


class RoomSummary(BaseModel):
    room_id: str
    room_code: str
    room_name: str
    seat: int | None
    chips: int
    status: str  # player status in room
    game_phase: str
    is_invited: bool  # True if not yet accepted (user_id is null or just invited)


@router.post("", response_model=UserResponse)
def api_create_user(req: CreateUserRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == req.username.strip()).first()
    if existing:
        # Login as existing user
        return UserResponse(user_id=existing.id, username=existing.username, user_token=existing.user_token)

    user = User(username=req.username.strip())
    db.add(user)
    db.flush()

    # Check for pending invitations matching this username
    pending = db.query(Player).filter(
        Player.invited_username == req.username.strip(),
        Player.user_id == None,
    ).all()
    for p in pending:
        p.user_id = user.id
        p.username = user.username

    db.commit()

    return UserResponse(user_id=user.id, username=user.username, user_token=user.user_token)


@router.get("/me", response_model=UserResponse)
def api_get_me(x_user_token: str = Header(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_token == x_user_token).first()
    if not user:
        raise HTTPException(401, "无效的用户令牌")
    return UserResponse(user_id=user.id, username=user.username, user_token=user.user_token)


@router.get("/me/rooms")
def api_my_rooms(x_user_token: str = Header(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_token == x_user_token).first()
    if not user:
        raise HTTPException(401, "无效的用户令牌")

    players = db.query(Player).filter(Player.user_id == user.id).all()
    rooms = []
    for p in players:
        room = p.room
        if room.status == "closed":
            continue
        rooms.append(RoomSummary(
            room_id=room.id,
            room_code=room.room_code,
            room_name=room.name,
            seat=p.seat,
            chips=p.chips,
            status=p.status,
            game_phase=room.game_phase,
            is_invited=not p.is_active,
        ))

    return {"rooms": rooms}
