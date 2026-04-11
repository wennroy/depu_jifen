from fastapi import Header, HTTPException, Depends, Path
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, Player, Room


def get_current_user(x_user_token: str = Header(...), db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.user_token == x_user_token).first()
    if not user:
        raise HTTPException(401, "无效的用户令牌")
    return user


def get_room_and_player(room_code: str = Path(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(404, "房间不存在")
    player = db.query(Player).filter(
        Player.room_id == room.id,
        Player.user_id == user.id,
        Player.is_active == True,
    ).first()
    if not player:
        raise HTTPException(403, "你不在该房间中")
    return room, player, user, db


def get_room_admin(deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    if user.id != room.creator_user_id:
        raise HTTPException(403, "只有房主才能执行此操作")
    return room, player, user, db
