from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Player
from backend.routers.deps import get_room_and_player
from backend.schemas.room import PlayerActionRequest, SettleHandRequest, SetAwayRequest
from backend.services.game_service import start_hand, player_action, next_betting_round, settle_hand, set_away

router = APIRouter(prefix="/api/rooms/{room_code}", tags=["game"])


@router.post("/start-hand")
async def api_start_hand(deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    if room.game_phase != "lobby":
        raise HTTPException(400, "当前不在等待阶段")
    try:
        await start_hand(db, room)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.post("/action")
async def api_action(req: PlayerActionRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    target = db.query(Player).filter(Player.id == req.target_player_id, Player.room_id == room.id).first()
    if not target:
        raise HTTPException(400, "目标玩家不存在")
    try:
        await player_action(db, room, target, req.action, req.amount)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.post("/next-round")
async def api_next_round(deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    try:
        await next_betting_round(db, room)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.post("/settle-hand")
async def api_settle_hand(req: SettleHandRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    try:
        await settle_hand(db, room, req.winners)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


@router.post("/set-status")
async def api_set_status(req: SetAwayRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    target = db.query(Player).filter(Player.id == req.player_id, Player.room_id == room.id).first()
    if not target:
        raise HTTPException(400, "目标玩家不存在")
    try:
        await set_away(db, room, target, req.away)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}
