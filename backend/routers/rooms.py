from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User, Room, Player, Transaction
from backend.routers.deps import get_current_user, get_room_and_player
from backend.schemas.room import (
    CreateRoomRequest, CreateRoomResponse,
    RoomInfoResponse, RoomStateResponse,
    PlayerState, TransactionLog,
)
from backend.services.room_service import create_room
from backend.services.ws_manager import manager

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.post("", response_model=CreateRoomResponse)
def api_create_room(req: CreateRoomRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = create_room(db, user, req.name, req.admin_username, req.initial_chips,
                         req.small_blind, req.big_blind)
    base_url = str(request.base_url).rstrip("/")
    result["share_link"] = f"{base_url}/join/{result['room_code']}"
    return result


@router.get("/{room_code}", response_model=RoomInfoResponse)
def api_room_info(room_code: str, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(404, "房间不存在")
    active_count = sum(1 for p in room.players if p.is_active)
    return RoomInfoResponse(
        room_code=room.room_code, name=room.name,
        player_count=active_count, status=room.status,
        initial_chips=room.initial_chips,
    )


@router.post("/{room_code}/accept-invite")
async def api_accept_invite(room_code: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(404, "房间不存在")

    player = db.query(Player).filter(
        Player.room_id == room.id,
        Player.user_id == user.id,
    ).first()
    if not player:
        raise HTTPException(400, "你没有该房间的邀请")
    if player.is_active:
        return {"ok": True, "already_joined": True}

    player.is_active = True
    player.status = "online"
    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "player_joined",
        "data": {
            "player_id": player.id, "username": player.username,
            "chips": player.chips, "seat": player.seat,
        },
    })
    return {"ok": True}


@router.get("/{room_code}/state", response_model=RoomStateResponse)
def api_room_state(deps=Depends(get_room_and_player)):
    room, player, user, db = deps

    players = [
        PlayerState(
            player_id=p.id, username=p.username, chips=p.chips, is_active=p.is_active,
            seat=p.seat, total_buyin=p.total_buyin, status=p.status, role=p.role,
            round_bet=p.round_bet, hand_bet=p.hand_bet, is_folded=p.is_folded,
        )
        for p in room.players
    ]

    recent_txs = (
        db.query(Transaction).filter(Transaction.room_id == room.id)
        .order_by(Transaction.created_at.desc()).limit(50).all()
    )
    transactions = [
        TransactionLog(
            id=tx.id, tx_type=tx.tx_type,
            from_username=tx.from_player.username if tx.from_player else None,
            to_username=tx.to_player.username if tx.to_player else None,
            amount=tx.amount, note=tx.note, created_at=tx.created_at.isoformat(),
        )
        for tx in recent_txs
    ]

    return RoomStateResponse(
        room_code=room.room_code, room_name=room.name,
        current_round=room.current_round, status=room.status,
        small_blind=room.small_blind, big_blind=room.big_blind,
        game_phase=room.game_phase, dealer_seat=room.dealer_seat,
        action_seat=room.action_seat, pot=room.pot,
        current_bet_level=room.current_bet_level,
        players=players, transactions=transactions,
        my_player_id=player.id,
    )
