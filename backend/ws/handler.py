import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from backend.database import get_db, SessionLocal
from backend.models import Player, Room
from backend.services.ws_manager import manager

router = APIRouter()


@router.websocket("/ws/{room_code}")
async def websocket_endpoint(ws: WebSocket, room_code: str, token: str = ""):
    db = SessionLocal()
    try:
        player = (
            db.query(Player)
            .join(Room)
            .filter(
                Room.room_code == room_code.upper(),
                Player.player_token == token,
                Player.is_active == True,
            )
            .first()
        )

        if not player:
            await ws.close(code=4003, reason="无效的玩家令牌")
            return

        await manager.connect(room_code.upper(), player.id, ws)

        try:
            while True:
                # Keep connection alive; client sends pings
                data = await asyncio.wait_for(ws.receive_text(), timeout=60)
                # We only handle pings from client
                if data == "ping":
                    await ws.send_text("pong")
        except (WebSocketDisconnect, asyncio.TimeoutError, Exception):
            pass
        finally:
            manager.disconnect(room_code.upper(), player.id)
    finally:
        db.close()
