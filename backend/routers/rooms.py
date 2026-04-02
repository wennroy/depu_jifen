from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Room, Player, Transaction
from backend.schemas.room import (
    CreateRoomRequest, CreateRoomResponse,
    JoinRoomRequest, JoinRoomResponse,
    RoomInfoResponse, RoomStateResponse,
    PlayerState, TransactionLog,
)
from backend.services.room_service import create_room, join_room
from backend.services.ws_manager import manager

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.post("", response_model=CreateRoomResponse)
def api_create_room(req: CreateRoomRequest, request: Request, db: Session = Depends(get_db)):
    result = create_room(db, req.name, req.admin_username, req.initial_chips)
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
        room_code=room.room_code,
        name=room.name,
        player_count=active_count,
        status=room.status,
        initial_chips=room.initial_chips,
    )


@router.post("/{room_code}/join", response_model=JoinRoomResponse)
async def api_join_room(room_code: str, req: JoinRoomRequest, db: Session = Depends(get_db)):
    try:
        result = join_room(db, room_code.upper(), req.username)
    except ValueError as e:
        raise HTTPException(400, str(e))

    await manager.broadcast(room_code.upper(), {
        "type": "player_joined",
        "data": {
            "player_id": result["player_id"],
            "username": req.username,
            "chips": result["chips"],
        },
    })
    return result


@router.get("/{room_code}/state", response_model=RoomStateResponse)
def api_room_state(
    room_code: str,
    x_player_token: str = Header(...),
    db: Session = Depends(get_db),
):
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(404, "房间不存在")

    player = db.query(Player).filter(
        Player.room_id == room.id,
        Player.player_token == x_player_token,
    ).first()
    if not player:
        raise HTTPException(403, "无效的玩家令牌")

    players = [
        PlayerState(
            player_id=p.id,
            username=p.username,
            chips=p.chips,
            is_active=p.is_active,
        )
        for p in room.players
    ]

    recent_txs = (
        db.query(Transaction)
        .filter(Transaction.room_id == room.id)
        .order_by(Transaction.created_at.desc())
        .limit(50)
        .all()
    )

    transactions = []
    for tx in recent_txs:
        transactions.append(TransactionLog(
            id=tx.id,
            tx_type=tx.tx_type,
            from_username=tx.from_player.username if tx.from_player else None,
            to_username=tx.to_player.username if tx.to_player else None,
            amount=tx.amount,
            note=tx.note,
            created_at=tx.created_at.isoformat(),
        ))

    is_admin = room.admin_token == db.query(Room).filter(
        Room.room_code == room_code.upper()
    ).first().admin_token and any(
        p.player_token == x_player_token for p in room.players
    )
    # Simpler: check if the player's token matches any admin relationship
    # We'll pass admin status via a header check in frontend
    # For now, check if there's an admin_token header too
    is_admin = False  # Will be set by frontend based on stored admin_token

    return RoomStateResponse(
        room_code=room.room_code,
        room_name=room.name,
        current_round=room.current_round,
        status=room.status,
        players=players,
        transactions=transactions,
        is_admin=is_admin,
        my_player_id=player.id,
    )
