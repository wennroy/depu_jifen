from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Room, Player, Transaction, User
from backend.routers.deps import get_room_and_player
from backend.schemas.room import AdjustRequest, KickRequest, UpdateBlindsRequest, UpdateSeatsRequest
from backend.services.chip_service import adjust_chips
from backend.services.ws_manager import manager

router = APIRouter(prefix="/api/rooms/{room_code}", tags=["manage"])


from pydantic import BaseModel, Field


class InviteRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    seat: int | None = None
    chips: int | None = None


@router.post("/invite")
async def api_invite_player(req: InviteRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps

    # Check if already invited
    existing = db.query(Player).filter(
        Player.room_id == room.id,
        Player.invited_username == req.username.strip(),
    ).first()
    if existing:
        raise HTTPException(400, f"{req.username} 已在房间中")

    # Find if user exists
    target_user = db.query(User).filter(User.username == req.username.strip()).first()

    # Auto-assign seat
    taken_seats = {p.seat for p in room.players if p.seat is not None}
    seat = req.seat
    if not seat:
        seat = 1
        while seat in taken_seats:
            seat += 1

    initial = req.chips or room.initial_chips

    new_player = Player(
        room_id=room.id,
        user_id=target_user.id if target_user else None,
        invited_username=req.username.strip(),
        username=req.username.strip(),
        chips=initial,
        seat=seat,
        is_active=True,
        total_buyin=initial,
        status="online" if target_user else "afk",
    )
    db.add(new_player)
    db.flush()

    db.add(Transaction(
        room_id=room.id, tx_type="join", to_player_id=new_player.id,
        amount=initial, note=f"邀请 {req.username.strip()} 到座位 {seat}",
    ))
    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "player_joined",
        "data": {
            "player_id": new_player.id, "username": new_player.username,
            "chips": new_player.chips, "seat": new_player.seat,
            "status": new_player.status,
        },
    })
    return {"ok": True, "player_id": new_player.id}


@router.post("/adjust")
async def api_adjust(req: AdjustRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    target = db.query(Player).filter(Player.id == req.player_id, Player.room_id == room.id).first()
    if not target:
        raise HTTPException(400, "玩家不存在")
    try:
        await adjust_chips(db, room, target, req.amount, req.note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "chips": target.chips}


@router.post("/kick")
async def api_kick(req: KickRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    target = db.query(Player).filter(
        Player.id == req.player_id, Player.room_id == room.id, Player.is_active == True,
    ).first()
    if not target:
        raise HTTPException(400, "玩家不存在")
    target.is_active = False
    db.commit()
    await manager.broadcast(room.room_code, {
        "type": "player_kicked",
        "data": {"player_id": target.id, "username": target.username},
    })
    return {"ok": True}


@router.post("/blinds")
async def api_update_blinds(req: UpdateBlindsRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    room.small_blind = req.small_blind
    room.big_blind = req.big_blind
    db.commit()
    await manager.broadcast(room.room_code, {
        "type": "blinds_updated",
        "data": {"small_blind": room.small_blind, "big_blind": room.big_blind},
    })
    return {"ok": True}


@router.post("/update-seats")
async def api_update_seats(req: UpdateSeatsRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    if room.game_phase != "lobby":
        raise HTTPException(400, "只能在等待阶段调整座位")
    new_seats = [a.seat for a in req.assignments]
    if len(new_seats) != len(set(new_seats)):
        raise HTTPException(400, "座位号不能重复")
    for a in req.assignments:
        p = db.query(Player).filter(Player.id == a.player_id, Player.room_id == room.id).first()
        if not p:
            raise HTTPException(400, "玩家不存在")
        p.seat = a.seat
    db.commit()
    players_data = [
        {"player_id": p.id, "username": p.username, "seat": p.seat}
        for p in db.query(Player).filter(Player.room_id == room.id, Player.is_active == True).all()
    ]
    await manager.broadcast(room.room_code, {"type": "seats_updated", "data": {"players": players_data}})
    return {"ok": True}


@router.get("/dashboard")
async def api_dashboard(deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    players = db.query(Player).filter(Player.room_id == room.id).all()
    buyin_records = []
    for p in players:
        rebuys = db.query(Transaction).filter(
            Transaction.room_id == room.id, Transaction.to_player_id == p.id, Transaction.tx_type == "rebuy",
        ).all()
        buyin_records.append({
            "player_id": p.id, "username": p.username, "seat": p.seat,
            "current_chips": p.chips, "initial_buyin": p.total_buyin,
            "rebuy_count": len(rebuys), "rebuy_total": sum(r.amount for r in rebuys),
            "total_invested": p.total_buyin + sum(r.amount for r in rebuys),
            "is_active": p.is_active,
        })
    return {"room_name": room.name, "room_code": room.room_code,
            "players": sorted(buyin_records, key=lambda x: x.get("seat") or 99)}


@router.post("/close")
async def api_close_room(deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    room.status = "closed"
    db.commit()
    await manager.broadcast(room.room_code, {"type": "room_closed", "data": {}})
    return {"ok": True}
