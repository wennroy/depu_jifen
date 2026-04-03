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


def create_room(db: Session, name: str, admin_username: str, initial_chips: int,
                small_blind: int = 5, big_blind: int = 10) -> dict:
    room_code = generate_room_code(db)
    admin_token = str(uuid4())

    room = Room(
        room_code=room_code,
        name=name,
        admin_token=admin_token,
        initial_chips=initial_chips,
        small_blind=small_blind,
        big_blind=big_blind,
    )
    db.add(room)
    db.flush()

    # Admin auto-joins as player at seat 1
    player_token = str(uuid4())
    player = Player(
        room_id=room.id,
        username=admin_username,
        chips=initial_chips,
        player_token=player_token,
        seat=1,
        total_buyin=initial_chips,
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


def preassign_player(db: Session, room: Room, username: str, seat: int, chips: int | None = None) -> Player:
    """Admin pre-creates a player slot. The actual user claims it by joining with the same username."""
    initial = chips if chips is not None else room.initial_chips

    # Check seat not taken (include preassigned but inactive)
    existing_seat = db.query(Player).filter(
        Player.room_id == room.id,
        Player.seat == seat,
    ).first()
    if existing_seat:
        raise ValueError(f"座位 {seat} 已被 {existing_seat.username} 占用")

    # Check username not taken
    existing_name = db.query(Player).filter(
        Player.room_id == room.id,
        Player.username == username,
    ).first()
    if existing_name:
        raise ValueError(f"昵称 {username} 已存在")

    player = Player(
        room_id=room.id,
        username=username,
        chips=initial,
        player_token=str(uuid4()),
        seat=seat,
        is_preassigned=True,
        is_active=False,  # Not active until claimed
        total_buyin=initial,
    )
    db.add(player)
    db.flush()

    tx = Transaction(
        room_id=room.id,
        tx_type="join",
        to_player_id=player.id,
        amount=initial,
        note=f"管理员预分配 {username} 到座位 {seat}",
    )
    db.add(tx)
    db.commit()
    return player


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

    # Claim a preassigned slot
    if existing and existing.is_preassigned and not existing.is_active:
        existing.is_active = True
        existing.player_token = str(uuid4())
        db.commit()
        return {
            "player_id": existing.id,
            "player_token": existing.player_token,
            "chips": existing.chips,
            "room_name": room.name,
            "seat": existing.seat,
        }

    if existing and existing.is_active:
        raise ValueError("该昵称已被使用")

    # Kicked player rejoining
    if existing and not existing.is_active:
        existing.is_active = True
        existing.chips = room.initial_chips
        existing.player_token = str(uuid4())
        existing.total_buyin = room.initial_chips
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
            "seat": existing.seat,
        }

    # Auto-assign next available seat
    taken_seats = {p.seat for p in room.players if p.seat is not None}
    next_seat = 1
    while next_seat in taken_seats:
        next_seat += 1

    player_token = str(uuid4())
    player = Player(
        room_id=room.id,
        username=username,
        chips=room.initial_chips,
        player_token=player_token,
        seat=next_seat,
        total_buyin=room.initial_chips,
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
        "seat": player.seat,
    }
