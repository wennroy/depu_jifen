"""Shared fixtures for all tests."""
import os
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Use in-memory SQLite for tests
os.environ["DB_PATH"] = ":memory:"
os.environ["SECRET_KEY"] = "test-secret"

from backend.database import Base
from backend.models import User, Room, Player, Transaction
from backend.services.ws_manager import ConnectionManager


@pytest.fixture()
def db():
    """Create a fresh in-memory database for each test."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def mock_manager(monkeypatch):
    """Replace the global ws manager with a no-op version that records broadcasts."""
    calls = []

    class MockManager:
        async def broadcast(self, room_code, message):
            calls.append({"room_code": room_code, "message": message})

        async def send_personal(self, room_code, player_id, message):
            calls.append({"room_code": room_code, "player_id": player_id, "message": message})

    mock = MockManager()
    import backend.services.ws_manager as ws_mod
    import backend.services.game_service as game_mod
    import backend.services.chip_service as chip_mod
    monkeypatch.setattr(ws_mod, "manager", mock)
    monkeypatch.setattr(game_mod, "manager", mock)
    monkeypatch.setattr(chip_mod, "manager", mock)
    return calls


def make_user(db, username="player1") -> User:
    """Helper to create a user."""
    user = User(username=username)
    db.add(user)
    db.flush()
    return user


def make_room(db, creator: User, name="Test Room",
              initial_chips=1000, small_blind=5, big_blind=10) -> Room:
    """Helper to create a room with the creator as the first player."""
    from backend.services.room_service import create_room
    result = create_room(db, creator, name, initial_chips, small_blind, big_blind)
    return db.query(Room).filter(Room.id == result["room_id"]).first()


def add_player(db, room: Room, user: User, seat: int, chips: int | None = None) -> Player:
    """Helper to add a player to a room."""
    c = chips if chips is not None else room.initial_chips
    player = Player(
        room_id=room.id, user_id=user.id,
        invited_username=user.username, username=user.username,
        chips=c, seat=seat, is_active=True,
        total_buyin=c, status="online", role="player",
    )
    db.add(player)
    db.flush()
    return player


def setup_game(db, num_players=3, initial_chips=1000, small_blind=5, big_blind=10):
    """Create a room with N players, ready to start a hand.
    Returns (room, [players], [users]).
    """
    users = [make_user(db, f"player{i+1}") for i in range(num_players)]
    room = make_room(db, users[0], initial_chips=initial_chips,
                     small_blind=small_blind, big_blind=big_blind)
    # First player is already created by make_room at seat 1
    player1 = db.query(Player).filter(Player.room_id == room.id, Player.user_id == users[0].id).first()
    players = [player1]
    for i, u in enumerate(users[1:], start=2):
        players.append(add_player(db, room, u, seat=i))
    db.expire(room, ['players'])
    return room, players, users
