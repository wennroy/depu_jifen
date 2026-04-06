from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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


class SetRoleRequest(BaseModel):
    player_id: str
    role: str  # "player" or "observer"
    seat: int | None = None


@router.post("/set-role")
async def api_set_role(req: SetRoleRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    if room.game_phase != "lobby":
        raise HTTPException(400, "只能在等待阶段切换角色")
    target = db.query(Player).filter(Player.id == req.player_id, Player.room_id == room.id).first()
    if not target:
        raise HTTPException(400, "目标玩家不存在")

    if req.role == "observer":
        target.role = "observer"
        target.seat = None
    elif req.role == "player":
        if not req.seat:
            taken = {p.seat for p in room.players if p.seat is not None}
            s = 1
            while s in taken:
                s += 1
            req.seat = s
        target.role = "player"
        target.seat = req.seat
        if target.chips <= 0:
            target.chips = room.initial_chips
            target.total_buyin += room.initial_chips
    else:
        raise HTTPException(400, "角色必须是 player 或 observer")

    db.commit()
    from backend.services.ws_manager import manager
    await manager.broadcast(room.room_code, {
        "type": "player_role_changed",
        "data": {"player_id": target.id, "username": target.username, "role": target.role, "seat": target.seat, "chips": target.chips},
    })
    return {"ok": True}
