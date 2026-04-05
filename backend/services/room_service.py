import secrets

from sqlalchemy.orm import Session

from backend.models import User, Room, Player, Transaction

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_room_code(db: Session, length: int = 6) -> str:
    for _ in range(100):
        code = "".join(secrets.choice(ALPHABET) for _ in range(length))
        if not db.query(Room).filter(Room.room_code == code).first():
            return code
    raise RuntimeError("Failed to generate unique room code")


def create_room(db: Session, user: User, name: str, admin_username: str,
                initial_chips: int, small_blind: int = 5, big_blind: int = 10) -> dict:
    room_code = generate_room_code(db)

    room = Room(
        room_code=room_code,
        name=name,
        creator_user_id=user.id,
        initial_chips=initial_chips,
        small_blind=small_blind,
        big_blind=big_blind,
    )
    db.add(room)
    db.flush()

    player = Player(
        room_id=room.id,
        user_id=user.id,
        invited_username=user.username,
        username=user.username,
        chips=initial_chips,
        seat=1,
        total_buyin=initial_chips,
        status="online",
    )
    db.add(player)
    db.flush()

    db.add(Transaction(
        room_id=room.id, tx_type="join", to_player_id=player.id,
        amount=initial_chips, note=f"{user.username} 创建并加入房间",
    ))
    db.commit()

    return {
        "room_id": room.id,
        "room_code": room.room_code,
        "admin_token": "",
        "player_id": player.id,
        "player_token": user.user_token,
    }
