import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.database import SessionLocal
from backend.models import User, Player, Room
from backend.services.ws_manager import manager

router = APIRouter()


@router.websocket("/ws/{room_code}")
async def websocket_endpoint(ws: WebSocket, room_code: str, token: str = ""):
    db = SessionLocal()
    player = None
    try:
        # Auth via user_token
        user = db.query(User).filter(User.user_token == token).first()
        if not user:
            await ws.close(code=4001, reason="无效的用户令牌")
            return

        room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
        if not room:
            await ws.close(code=4004, reason="房间不存在")
            return

        player = db.query(Player).filter(
            Player.room_id == room.id,
            Player.user_id == user.id,
            Player.is_active == True,
        ).first()
        if not player:
            await ws.close(code=4003, reason="你不在该房间中")
            return

        await manager.connect(room_code.upper(), player.id, ws)

        # Set online
        if player.status == "afk":
            player.status = "online"
            db.commit()
            await manager.broadcast(room_code.upper(), {
                "type": "player_status",
                "data": {"player_id": player.id, "username": player.username, "status": "online"},
            })

        try:
            while True:
                data = await asyncio.wait_for(ws.receive_text(), timeout=60)
                if data == "ping":
                    await ws.send_text("pong")
        except (WebSocketDisconnect, asyncio.TimeoutError, Exception):
            pass
        finally:
            manager.disconnect(room_code.upper(), player.id)
            # Set AFK on disconnect (only if still in a game, not sitout)
            db.refresh(player)
            if player.status == "online":
                player.status = "afk"
                db.commit()
                await manager.broadcast(room_code.upper(), {
                    "type": "player_status",
                    "data": {"player_id": player.id, "username": player.username, "status": "afk"},
                })
    finally:
        db.close()
