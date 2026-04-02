import secrets
from uuid import uuid4

from sqlalchemy.orm import Session

from backend.models import Room, Player, Transaction

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_room_code(db: Session, length: int = 6) -> str:
    for _ in range(100):
        code = "".join(secrets.choice(ALPHABET) for _ in range(length))
        if not db.query(Room).filter(Room.room_code == code).first():
            return code
    raise RuntimeError("Failed to generate unique room code")


def create_room(db: Session, name: str, admin_username: str, initial_chips: int) -> dict:
    room_code = generate_room_code(db)
    admin_token = str(uuid4())

    room = Room(
        room_code=room_code,
        name=name,
        admin_token=admin_token,
        initial_chips=initial_chips,
    )
    db.add(room)
    db.flush()

    # Admin auto-joins as player
    player_token = str(uuid4())
    player = Player(
        room_id=room.id,
        username=admin_username,
        chips=initial_chips,
        player_token=player_token,
    )
    db.add(player)
    db.flush()

    tx = Transaction(
        room_id=room.id,
        tx_type="join",
        to_player_id=player.id,
        amount=initial_chips,
        note=f"{admin_username} 创建并加入房间",
    )
    db.add(tx)
    db.commit()

    return {
        "room_id": room.id,
        "room_code": room.room_code,
        "admin_token": admin_token,
        "player_id": player.id,
        "player_token": player_token,
    }


def join_room(db: Session, room_code: str, username: str) -> dict:
    room = db.query(Room).filter(Room.room_code == room_code).first()
    if not room:
        raise ValueError("房间不存在")
    if room.status != "active":
        raise ValueError("房间已关闭")

    existing = db.query(Player).filter(
        Player.room_id == room.id,
        Player.username == username,
    ).first()

    if existing and existing.is_active:
        raise ValueError("该昵称已被使用")

    # If player was kicked and rejoins
    if existing and not existing.is_active:
        existing.is_active = True
        existing.chips = room.initial_chips
        existing.player_token = str(uuid4())
        db.flush()
        tx = Transaction(
            room_id=room.id,
            tx_type="join",
            to_player_id=existing.id,
            amount=room.initial_chips,
            note=f"{username} 重新加入房间",
        )
        db.add(tx)
        db.commit()
        return {
            "player_id": existing.id,
            "player_token": existing.player_token,
            "chips": existing.chips,
            "room_name": room.name,
        }

    player_token = str(uuid4())
    player = Player(
        room_id=room.id,
        username=username,
        chips=room.initial_chips,
        player_token=player_token,
    )
    db.add(player)
    db.flush()

    tx = Transaction(
        room_id=room.id,
        tx_type="join",
        to_player_id=player.id,
        amount=room.initial_chips,
        note=f"{username} 加入房间",
    )
    db.add(tx)
    db.commit()

    return {
        "player_id": player.id,
        "player_token": player_token,
        "chips": player.chips,
        "room_name": room.name,
    }
