from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Room, Player, Transaction
from backend.schemas.room import BetRequest, TransferRequest, RebuyRequest
from backend.services.chip_service import place_bet, transfer_chips
from backend.services.ws_manager import manager

router = APIRouter(prefix="/api/rooms/{room_code}", tags=["players"])


@router.post("/bet")
async def api_bet(
    room_code: str,
    req: BetRequest,
    x_player_token: str = Header(...),
    db: Session = Depends(get_db),
):
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(404, "房间不存在")

    player = db.query(Player).filter(
        Player.room_id == room.id,
        Player.player_token == x_player_token,
        Player.is_active == True,
    ).first()
    if not player:
        raise HTTPException(403, "无效的玩家令牌")

    try:
        await place_bet(db, player, req.amount)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "chips": player.chips}


@router.post("/transfer")
async def api_transfer(
    room_code: str,
    req: TransferRequest,
    x_player_token: str = Header(...),
    db: Session = Depends(get_db),
):
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(404, "房间不存在")

    sender = db.query(Player).filter(
        Player.room_id == room.id,
        Player.player_token == x_player_token,
        Player.is_active == True,
    ).first()
    if not sender:
        raise HTTPException(403, "无效的玩家令牌")

    receiver = db.query(Player).filter(
        Player.id == req.to_player_id,
        Player.room_id == room.id,
        Player.is_active == True,
    ).first()
    if not receiver:
        raise HTTPException(400, "目标玩家不存在")

    try:
        await transfer_chips(db, sender, receiver, req.amount)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "chips": sender.chips}


@router.post("/rebuy")
async def api_rebuy(
    room_code: str,
    req: RebuyRequest,
    x_player_token: str = Header(...),
    db: Session = Depends(get_db),
):
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(404, "房间不存在")

    player = db.query(Player).filter(
        Player.room_id == room.id,
        Player.player_token == x_player_token,
        Player.is_active == True,
    ).first()
    if not player:
        raise HTTPException(403, "无效的玩家令牌")

    player.chips += req.amount
    player.total_buyin += req.amount

    tx = Transaction(
        room_id=room.id,
        tx_type="rebuy",
        to_player_id=player.id,
        amount=req.amount,
        note=f"{player.username} 买入 {req.amount} 筹码",
    )
    db.add(tx)
    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "chips_updated",
        "data": {
            "player_id": player.id,
            "username": player.username,
            "chips": player.chips,
            "delta": req.amount,
            "reason": f"买入 {req.amount}",
        },
    })
    return {"ok": True, "chips": player.chips}
