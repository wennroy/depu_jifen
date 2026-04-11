"""Tests for user creation/login and room creation/joining."""
import pytest
from backend.models import User, Room, Player
from backend.services.room_service import create_room
from tests.conftest import make_user, make_room, add_player


class TestUserCreation:
    def test_create_new_user(self, db):
        user = make_user(db, "alice")
        assert user.username == "alice"
        assert user.user_token is not None
        assert user.id is not None

    def test_unique_username(self, db):
        make_user(db, "alice")
        db.commit()
        # Creating another user with same name should fail at DB level
        from sqlalchemy.exc import IntegrityError
        with pytest.raises(IntegrityError):
            u2 = User(username="alice")
            db.add(u2)
            db.flush()

    def test_unique_tokens(self, db):
        u1 = make_user(db, "alice")
        u2 = make_user(db, "bob")
        assert u1.user_token != u2.user_token


class TestRoomCreation:
    def test_create_room(self, db):
        user = make_user(db, "host")
        room = make_room(db, user)
        assert room.room_code is not None
        assert len(room.room_code) == 6
        assert room.status == "active"
        assert room.game_phase == "lobby"
        assert room.creator_user_id == user.id

    def test_creator_auto_joins(self, db):
        user = make_user(db, "host")
        room = make_room(db, user)
        player = db.query(Player).filter(Player.room_id == room.id).first()
        assert player is not None
        assert player.user_id == user.id
        assert player.seat == 1
        assert player.chips == room.initial_chips

    def test_room_initial_settings(self, db):
        user = make_user(db, "host")
        room = make_room(db, user, initial_chips=2000, small_blind=10, big_blind=20)
        assert room.initial_chips == 2000
        assert room.small_blind == 10
        assert room.big_blind == 20


class TestRoomJoining:
    def test_add_player(self, db):
        user1 = make_user(db, "host")
        user2 = make_user(db, "guest")
        room = make_room(db, user1)
        player = add_player(db, room, user2, seat=2)
        assert player.seat == 2
        assert player.chips == room.initial_chips

    def test_multiple_players(self, db):
        from tests.conftest import setup_game
        room, players, _ = setup_game(db, 5)
        assert len(players) == 5
        seats = [p.seat for p in players]
        assert len(set(seats)) == 5  # All unique seats

    def test_player_custom_chips(self, db):
        user1 = make_user(db, "host")
        user2 = make_user(db, "guest")
        room = make_room(db, user1, initial_chips=1000)
        player = add_player(db, room, user2, seat=2, chips=500)
        assert player.chips == 500


class TestInviteFlow:
    def test_pending_invite_linked_on_register(self, db):
        """When a user registers with a name matching a pending invite, they get linked."""
        host = make_user(db, "host")
        room = make_room(db, host)

        # Create an invite for "bob" (no user exists yet)
        invite = Player(
            room_id=room.id, user_id=None,
            invited_username="bob", username="bob",
            chips=room.initial_chips, seat=2, is_active=True,
            total_buyin=room.initial_chips, status="afk",
        )
        db.add(invite)
        db.commit()

        # Now "bob" registers
        bob = User(username="bob")
        db.add(bob)
        db.flush()

        # Link pending invites
        pending = db.query(Player).filter(
            Player.invited_username == "bob",
            Player.user_id == None,
        ).all()
        for p in pending:
            p.user_id = bob.id
        db.commit()

        # Verify link
        invite = db.query(Player).filter(Player.room_id == room.id, Player.seat == 2).first()
        assert invite.user_id == bob.id
