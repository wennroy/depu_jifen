from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Player, Transaction
from backend.routers.deps import get_room_and_player
from backend.schemas.room import BetRequest, TransferRequest, RebuyRequest
from backend.services.chip_service import place_bet, transfer_chips
from backend.services.ws_manager import manager

router = APIRouter(prefix="/api/rooms/{room_code}", tags=["players"])


@router.post("/bet")
async def api_bet(req: BetRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    try:
        await place_bet(db, player, req.amount)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "chips": player.chips}


@router.post("/transfer")
async def api_transfer(req: TransferRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    receiver = db.query(Player).filter(
        Player.id == req.to_player_id, Player.room_id == room.id, Player.is_active == True,
    ).first()
    if not receiver:
        raise HTTPException(400, "目标玩家不存在")
    try:
        await transfer_chips(db, player, receiver, req.amount)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "chips": player.chips}


@router.post("/rebuy")
async def api_rebuy(req: RebuyRequest, deps=Depends(get_room_and_player)):
    room, player, user, db = deps
    player.chips += req.amount
    player.total_buyin += req.amount
    db.add(Transaction(
        room_id=room.id, tx_type="rebuy", to_player_id=player.id,
        amount=req.amount, note=f"{player.username} 买入 {req.amount} 筹码",
    ))
    db.commit()
    await manager.broadcast(room.room_code, {
        "type": "chips_updated",
        "data": {
            "player_id": player.id, "username": player.username,
            "chips": player.chips, "delta": req.amount, "reason": f"买入 {req.amount}",
        },
    })
    return {"ok": True, "chips": player.chips}
