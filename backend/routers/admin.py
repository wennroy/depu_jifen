from fastapi import APIRouter, Depends, Header, HTTPException, Path
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Room, Player, Transaction
from backend.schemas.transaction import SettleRequest, AdjustRequest, KickRequest
from backend.schemas.room import PreassignPlayerRequest, UpdateBlindsRequest
from backend.services.chip_service import settle_round, adjust_chips
from backend.services.room_service import preassign_player
from backend.services.ws_manager import manager

router = APIRouter(prefix="/api/rooms/{room_code}", tags=["admin"])


def get_admin_room(room_code: str = Path(...), x_admin_token: str = Header(...), db: Session = Depends(get_db)) -> Room:
    room = db.query(Room).filter(
        Room.room_code == room_code.upper(),
        Room.admin_token == x_admin_token,
    ).first()
    if not room:
        raise HTTPException(403, "无效的管理员令牌")
    return room


@router.post("/check-admin")
async def api_check_admin(room_code: str = Path(...), x_admin_token: str = Header(...), db: Session = Depends(get_db)):
    room = db.query(Room).filter(
        Room.room_code == room_code.upper(),
        Room.admin_token == x_admin_token,
    ).first()
    return {"is_admin": room is not None}


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


@router.post("/preassign")
async def api_preassign(
    req: PreassignPlayerRequest,
    room: Room = Depends(get_admin_room),
    db: Session = Depends(get_db),
):
    try:
        player = preassign_player(db, room, req.username, req.seat, req.chips)
    except ValueError as e:
        raise HTTPException(400, str(e))

    await manager.broadcast(room.room_code, {
        "type": "player_preassigned",
        "data": {
            "player_id": player.id,
            "username": player.username,
            "chips": player.chips,
            "seat": player.seat,
        },
    })
    return {"ok": True, "player_id": player.id}


@router.post("/blinds")
async def api_update_blinds(
    req: UpdateBlindsRequest,
    room: Room = Depends(get_admin_room),
    db: Session = Depends(get_db),
):
    room.small_blind = req.small_blind
    room.big_blind = req.big_blind
    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "blinds_updated",
        "data": {"small_blind": room.small_blind, "big_blind": room.big_blind},
    })
    return {"ok": True}


@router.get("/dashboard")
async def api_dashboard(
    room: Room = Depends(get_admin_room),
    db: Session = Depends(get_db),
):
    """Rebuy dashboard: who bought how many chips total."""
    players = db.query(Player).filter(Player.room_id == room.id).all()
    buyin_records = []
    for p in players:
        # Get all rebuy transactions
        rebuys = (
            db.query(Transaction)
            .filter(
                Transaction.room_id == room.id,
                Transaction.to_player_id == p.id,
                Transaction.tx_type == "rebuy",
            )
            .all()
        )
        buyin_records.append({
            "player_id": p.id,
            "username": p.username,
            "seat": p.seat,
            "current_chips": p.chips,
            "initial_buyin": p.total_buyin,
            "rebuy_count": len(rebuys),
            "rebuy_total": sum(r.amount for r in rebuys),
            "total_invested": p.total_buyin + sum(r.amount for r in rebuys),
            "is_active": p.is_active,
        })

    return {
        "room_name": room.name,
        "room_code": room.room_code,
        "players": sorted(buyin_records, key=lambda x: x.get("seat") or 99),
    }
