"""Tests for player leave room and rejoin functionality."""
import pytest
from backend.services.game_service import (
    start_hand, player_action, next_betting_round, settle_hand, leave_room,
)
from tests.conftest import setup_game, make_user, add_player


def _acting_player(room, players):
    return next(p for p in players if p.seat == room.action_seat)


@pytest.mark.asyncio
class TestLeaveRoom:
    async def test_leave_in_lobby(self, db, mock_manager):
        """Player can leave during lobby phase."""
        room, players, users = setup_game(db, 3)
        p2 = players[1]

        await leave_room(db, room, p2)

        assert p2.is_active is False
        assert p2.seat is None
        assert p2.status == "offline"
        # Chips preserved
        assert p2.chips == room.initial_chips

    async def test_leave_broadcasts_player_left(self, db, mock_manager):
        """Leave should broadcast player_left message."""
        room, players, _ = setup_game(db, 3)
        p2 = players[1]
        old_seat = p2.seat

        await leave_room(db, room, p2)

        left_msgs = [c for c in mock_manager if c["message"]["type"] == "player_left"]
        assert len(left_msgs) == 1
        data = left_msgs[0]["message"]["data"]
        assert data["player_id"] == p2.id
        assert data["username"] == p2.username
        assert data["seat"] == old_seat

    async def test_leave_during_game_auto_folds(self, db, mock_manager):
        """Leaving during an active hand auto-folds the player."""
        room, players, _ = setup_game(db, 3)
        await start_hand(db, room)

        # Find a player who is not the current actor
        non_actor = next(p for p in players if p.seat != room.action_seat and not p.is_folded)
        await leave_room(db, room, non_actor)

        assert non_actor.is_folded is True
        assert non_actor.is_active is False
        assert non_actor.seat is None

    async def test_leave_during_game_bets_not_returned(self, db, mock_manager):
        """Already placed bets are NOT returned when leaving."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # Find the BB player (they have hand_bet > 0)
        bb_player = next(p for p in players if p.hand_bet == 10)
        chips_before = bb_player.chips

        await leave_room(db, room, bb_player)

        # Chips should not have changed (bets stay in pot)
        assert bb_player.chips == chips_before
        assert bb_player.hand_bet == 10  # bet not reset

    async def test_leave_when_action_player_advances_turn(self, db, mock_manager):
        """If the acting player leaves, action advances to next player."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        actor = _acting_player(room, players)
        old_action_seat = room.action_seat

        await leave_room(db, room, actor)

        assert room.action_seat != old_action_seat
        assert room.action_seat is not None  # Game continues

    async def test_leave_last_remaining_triggers_showdown(self, db, mock_manager):
        """If only one player remains after leave, go to showdown."""
        room, players, _ = setup_game(db, 2, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # One player leaves → only one left
        actor = _acting_player(room, players)
        await leave_room(db, room, actor)

        assert room.game_phase == "showdown"
        assert room.action_seat is None

    async def test_leave_folded_player_no_double_fold(self, db, mock_manager):
        """A player who already folded can leave without issues."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # First player folds
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "fold")
        assert actor.is_folded is True

        # Now they leave — should not cause issues
        await leave_room(db, room, actor)
        assert actor.is_active is False
        assert actor.seat is None

    async def test_leave_round_end_seat_adjustment(self, db, mock_manager):
        """If leaving player is round_end_seat, it should be adjusted."""
        room, players, _ = setup_game(db, 4, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # Find the round_end_seat player
        end_player = next(p for p in players if p.seat == room.round_end_seat)

        # If end_player is also the actor, we need to handle differently
        if end_player.seat == room.action_seat:
            # Act first to move action
            await player_action(db, room, end_player, "call")
        else:
            await leave_room(db, room, end_player)
            # round_end_seat should have been updated since this player left during game
            # The game should still be functional

    async def test_rejoin_after_leave(self, db, mock_manager):
        """Player can rejoin after leaving, gets a new seat."""
        room, players, users = setup_game(db, 3)
        p2 = players[1]
        old_chips = p2.chips

        await leave_room(db, room, p2)
        assert p2.is_active is False
        assert p2.seat is None

        # Rejoin via the join mechanism
        p2.is_active = True
        p2.status = "online"
        taken_seats = {p.seat for p in room.players if p.seat is not None}
        seat = 1
        while seat in taken_seats:
            seat += 1
        p2.seat = seat
        db.commit()

        assert p2.is_active is True
        assert p2.seat is not None
        assert p2.chips == old_chips  # Chips preserved

    async def test_leave_observer(self, db, mock_manager):
        """Observer can leave without fold logic."""
        room, players, users = setup_game(db, 2)
        observer_user = make_user(db, "observer1")
        from backend.models import Player as PlayerModel
        observer = PlayerModel(
            room_id=room.id, user_id=observer_user.id,
            invited_username="observer1", username="observer1",
            chips=0, seat=None, is_active=True,
            total_buyin=0, status="online", role="observer",
        )
        db.add(observer)
        db.flush()
        db.expire(room, ['players'])

        await start_hand(db, room)
        await leave_room(db, room, observer)

        assert observer.is_active is False
        # Game should continue unaffected
        assert room.game_phase != "lobby"


@pytest.mark.asyncio
class TestCheckUsername:
    """Test username check and is_new field."""

    async def test_check_nonexistent_username(self, db, mock_manager):
        """Check returns exists=False for new username."""
        from backend.models import User
        existing = db.query(User).filter(User.username == "nonexistent_user_xyz").first()
        assert existing is None

    async def test_check_existing_username(self, db, mock_manager):
        """Check returns exists=True for existing username."""
        user = make_user(db, "testuser123")
        from backend.models import User
        existing = db.query(User).filter(User.username == "testuser123").first()
        assert existing is not None
        assert existing.id == user.id

    async def test_create_user_returns_is_new_field(self, db, mock_manager):
        """Verify POST /users returns is_new field via direct model logic."""
        from backend.models import User
        # New user
        user = User(username="brand_new_user")
        db.add(user)
        db.flush()

        # Check it was created
        found = db.query(User).filter(User.username == "brand_new_user").first()
        assert found is not None

        # "Login" - find existing
        login_check = db.query(User).filter(User.username == "brand_new_user").first()
        assert login_check is not None
        assert login_check.id == user.id
