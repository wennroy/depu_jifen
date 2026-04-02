from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Room, Player
from backend.schemas.transaction import SettleRequest, AdjustRequest, KickRequest
from backend.services.chip_service import settle_round, adjust_chips
from backend.services.ws_manager import manager

router = APIRouter(prefix="/api/rooms/{room_code}", tags=["admin"])


def get_admin_room(room_code: str, x_admin_token: str = Header(...), db: Session = Depends(get_db)) -> Room:
    room = db.query(Room).filter(
        Room.room_code == room_code.upper(),
        Room.admin_token == x_admin_token,
    ).first()
    if not room:
        raise HTTPException(403, "无效的管理员令牌")
    return room


@router.post("/rounds/next")
async def api_next_round(room: Room = Depends(get_admin_room), db: Session = Depends(get_db)):
    room.current_round += 1
    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "round_advanced",
        "data": {"round": room.current_round},
    })
    return {"ok": True, "round": room.current_round}


@router.post("/settle")
async def api_settle(
    req: SettleRequest,
    room: Room = Depends(get_admin_room),
    db: Session = Depends(get_db),
):
    try:
        await settle_round(db, room, [s.model_dump() for s in req.settlements])
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.post("/adjust")
async def api_adjust(
    req: AdjustRequest,
    room: Room = Depends(get_admin_room),
    db: Session = Depends(get_db),
):
    player = db.query(Player).filter(
        Player.id == req.player_id,
        Player.room_id == room.id,
    ).first()
    if not player:
        raise HTTPException(400, "玩家不存在")

    try:
        await adjust_chips(db, room, player, req.amount, req.note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "chips": player.chips}


@router.post("/kick")
async def api_kick(
    req: KickRequest,
    room: Room = Depends(get_admin_room),
    db: Session = Depends(get_db),
):
    player = db.query(Player).filter(
        Player.id == req.player_id,
        Player.room_id == room.id,
        Player.is_active == True,
    ).first()
    if not player:
        raise HTTPException(400, "玩家不存在")

    player.is_active = False
    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "player_kicked",
        "data": {"player_id": player.id, "username": player.username},
    })
    return {"ok": True}


@router.post("/close")
async def api_close_room(room: Room = Depends(get_admin_room), db: Session = Depends(get_db)):
    room.status = "closed"
    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "room_closed",
        "data": {},
    })
    return {"ok": True}


@router.post("/check-admin")
async def api_check_admin(room_code: str, x_admin_token: str = Header(...), db: Session = Depends(get_db)):
    room = db.query(Room).filter(
        Room.room_code == room_code.upper(),
        Room.admin_token == x_admin_token,
    ).first()
    return {"is_admin": room is not None}
