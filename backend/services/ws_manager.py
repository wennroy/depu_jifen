from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # room_code -> { player_id -> WebSocket }
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, room_code: str, player_id: str, ws: WebSocket):
        await ws.accept()
        if room_code not in self.rooms:
            self.rooms[room_code] = {}
        self.rooms[room_code][player_id] = ws

    def disconnect(self, room_code: str, player_id: str):
        if room_code in self.rooms:
            self.rooms[room_code].pop(player_id, None)
            if not self.rooms[room_code]:
                del self.rooms[room_code]

    async def broadcast(self, room_code: str, message: dict):
        if room_code not in self.rooms:
            return
        dead = []
        for pid, ws in self.rooms[room_code].items():
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(pid)
        for pid in dead:
            self.rooms[room_code].pop(pid, None)

    async def send_personal(self, room_code: str, player_id: str, message: dict):
        ws = self.rooms.get(room_code, {}).get(player_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()
