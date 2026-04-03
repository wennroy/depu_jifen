from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Room, Player
from backend.schemas.room import PlayerActionRequest, SettleHandRequest, SetAwayRequest
from backend.services.game_service import start_hand, player_action, next_betting_round, settle_hand, set_away

router = APIRouter(prefix="/api/rooms/{room_code}", tags=["game"])


def _get_room_and_caller(room_code: str, x_player_token: str = Header(...), db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(404, "房间不存在")
    caller = db.query(Player).filter(
        Player.room_id == room.id,
        Player.player_token == x_player_token,
        Player.is_active == True,
    ).first()
    if not caller:
        raise HTTPException(403, "无效的玩家令牌")
    return room, caller, db


@router.post("/start-hand")
async def api_start_hand(room_code: str, x_player_token: str = Header(...), db: Session = Depends(get_db)):
    room, caller, db = _get_room_and_caller(room_code, x_player_token, db)
    if room.game_phase != "lobby":
        raise HTTPException(400, "当前不在等待阶段")
    try:
        await start_hand(db, room)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.post("/action")
async def api_action(room_code: str, req: PlayerActionRequest, x_player_token: str = Header(...), db: Session = Depends(get_db)):
    room, caller, db = _get_room_and_caller(room_code, x_player_token, db)
    target = db.query(Player).filter(Player.id == req.target_player_id, Player.room_id == room.id).first()
    if not target:
        raise HTTPException(400, "目标玩家不存在")
    try:
        await player_action(db, room, target, req.action, req.amount)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.post("/next-round")
async def api_next_round(room_code: str, x_player_token: str = Header(...), db: Session = Depends(get_db)):
    room, caller, db = _get_room_and_caller(room_code, x_player_token, db)
    try:
        await next_betting_round(db, room)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.post("/settle-hand")
async def api_settle_hand(room_code: str, req: SettleHandRequest, x_player_token: str = Header(...), db: Session = Depends(get_db)):
    room, caller, db = _get_room_and_caller(room_code, x_player_token, db)
    try:
        await settle_hand(db, room, req.winners)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.post("/set-away")
async def api_set_away(room_code: str, req: SetAwayRequest, x_player_token: str = Header(...), db: Session = Depends(get_db)):
    room, caller, db = _get_room_and_caller(room_code, x_player_token, db)
    target = db.query(Player).filter(Player.id == req.player_id, Player.room_id == room.id).first()
    if not target:
        raise HTTPException(400, "目标玩家不存在")
    try:
        await set_away(db, room, target, req.away)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}
