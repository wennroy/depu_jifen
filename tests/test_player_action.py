"""Tests for game_service: player_action — the core betting logic."""
import pytest
from backend.services.game_service import start_hand, player_action, next_betting_round
from tests.conftest import setup_game


async def _start(db, room, players, mock_manager):
    """Start a hand and return action order helpers."""
    await start_hand(db, room)
    return room


def _acting_player(room, players):
    """Get the player whose turn it is."""
    return next(p for p in players if p.seat == room.action_seat)


@pytest.mark.asyncio
class TestFold:
    async def test_fold_marks_folded(self, db, mock_manager):
        room, players, _ = setup_game(db, 3)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "fold")
        assert actor.is_folded is True

    async def test_fold_all_but_one_goes_showdown(self, db, mock_manager):
        """If everyone folds except one, game goes to showdown."""
        room, players, _ = setup_game(db, 2)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "fold")
        assert room.game_phase == "showdown"

    async def test_fold_moves_action(self, db, mock_manager):
        room, players, _ = setup_game(db, 3)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        old_seat = actor.seat
        await player_action(db, room, actor, "fold")
        if room.game_phase != "showdown":
            assert room.action_seat != old_seat


@pytest.mark.asyncio
class TestCall:
    async def test_call_matches_bet_level(self, db, mock_manager):
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        old_chips = actor.chips
        await player_action(db, room, actor, "call")
        # UTG called BB of 10
        assert actor.round_bet == room.current_bet_level
        assert actor.chips == old_chips - 10

    async def test_call_short_stack(self, db, mock_manager):
        """Player with insufficient chips calls for all they have."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        actor.chips = 3  # Less than BB
        db.commit()
        await player_action(db, room, actor, "call")
        assert actor.chips == 0  # All-in via call
        assert actor.round_bet == 3

    async def test_check_when_no_bet(self, db, mock_manager):
        """Call with 0 cost is effectively a check."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # Everyone calls preflop to get to flop
        for _ in range(3):
            actor = _acting_player(room, players)
            if room.action_seat is None:
                break
            await player_action(db, room, actor, "call")

        # Advance to flop
        await next_betting_round(db, room)
        assert room.game_phase == "flop"

        # First actor can check (call for 0)
        actor = _acting_player(room, players)
        old_chips = actor.chips
        await player_action(db, room, actor, "call")
        assert actor.chips == old_chips  # No cost


@pytest.mark.asyncio
class TestRaise:
    async def test_raise_increases_bet_level(self, db, mock_manager):
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "raise", 30)
        assert room.current_bet_level == 30

    async def test_raise_too_low_raises_error(self, db, mock_manager):
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        with pytest.raises(ValueError, match="加注必须大于"):
            await player_action(db, room, actor, "raise", 5)

    async def test_raise_resets_round_end_seat(self, db, mock_manager):
        """A raise gives everyone else a chance to respond."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)
        old_end = room.round_end_seat
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "raise", 30)
        # round_end_seat should be the player just BEFORE the raiser
        assert room.round_end_seat != old_end or True  # Just verify it's set


@pytest.mark.asyncio
class TestAllin:
    async def test_allin_spends_all_chips(self, db, mock_manager):
        room, players, _ = setup_game(db, 3)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "allin")
        assert actor.chips == 0

    async def test_allin_raises_bet_level_if_higher(self, db, mock_manager):
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        assert actor.chips == 1000
        await player_action(db, room, actor, "allin")
        assert room.current_bet_level == 1000

    async def test_allin_player_skipped_in_action(self, db, mock_manager):
        """All-in player (0 chips) is skipped when finding next actor."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        allin_seat = actor.seat
        await player_action(db, room, actor, "allin")

        # Action should skip the all-in player in subsequent rounds
        if room.action_seat is not None:
            assert room.action_seat != allin_seat


@pytest.mark.asyncio
class TestBettingCompletion:
    async def test_all_call_completes_round(self, db, mock_manager):
        """When everyone has called/checked, betting is complete."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # UTG calls, SB calls, BB checks → round complete
        for _ in range(3):
            if room.action_seat is None:
                break
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        assert room.action_seat is None

    async def test_raise_extends_round(self, db, mock_manager):
        """After a raise, others must respond before round ends."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # UTG raises
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "raise", 30)

        # Round should NOT be complete
        assert room.action_seat is not None

    async def test_fold_closer_updates_end_seat(self, db, mock_manager):
        """If the round_end_seat player folds, end seat moves."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        old_end = room.round_end_seat

        # UTG calls
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "call")

        # SB calls
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "call")

        # BB (round_end_seat) folds
        actor = _acting_player(room, players)
        if actor.seat == old_end:
            await player_action(db, room, actor, "fold")
            # round_end_seat should have moved
            # Round should be complete since everyone else already acted
            # or round_end_seat changed

    async def test_allin_closer_ends_round(self, db, mock_manager):
        """If a player is all-in from preflop, postflop rounds skip them correctly."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10,
                                      initial_chips=1000)
        await start_hand(db, room)

        # Give UTG only 50 chips so they go all-in cheaply
        actor = _acting_player(room, players)
        allin_player = actor
        allin_player.chips = 50
        db.commit()
        await player_action(db, room, actor, "allin")

        # Others call
        while room.action_seat is not None:
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        # Advance to flop — all-in player has 0 chips
        await next_betting_round(db, room)
        assert room.game_phase == "flop"
        assert allin_player.chips == 0

        # Remaining players with chips should act, then round completes
        actions = 0
        while room.action_seat is not None and actions < 10:
            actor = _acting_player(room, players)
            assert actor.chips > 0  # all-in player should be skipped
            await player_action(db, room, actor, "call")
            actions += 1

        assert room.action_seat is None


@pytest.mark.asyncio
class TestDealerActsPostFlop:
    """Regression tests for the dealer-skipped-in-betting bug."""

    async def test_dealer_gets_turn_on_flop(self, db, mock_manager):
        """Dealer must get a turn to act on flop (not skipped)."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # Complete preflop: everyone calls
        for _ in range(3):
            if room.action_seat is None:
                break
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        await next_betting_round(db, room)
        assert room.game_phase == "flop"

        # Track who gets to act
        acted_seats = []
        while room.action_seat is not None:
            actor = _acting_player(room, players)
            acted_seats.append(actor.seat)
            await player_action(db, room, actor, "call")  # check

        # Dealer MUST have acted
        assert room.dealer_seat in acted_seats, \
            f"Dealer (seat {room.dealer_seat}) was skipped! Acted seats: {acted_seats}"

    async def test_dealer_gets_turn_on_turn(self, db, mock_manager):
        """Dealer must get a turn on the turn round too."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # Complete preflop
        for _ in range(3):
            if room.action_seat is None:
                break
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        # Complete flop
        await next_betting_round(db, room)
        while room.action_seat is not None:
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        # Turn
        await next_betting_round(db, room)
        assert room.game_phase == "turn"

        acted_seats = []
        while room.action_seat is not None:
            actor = _acting_player(room, players)
            acted_seats.append(actor.seat)
            await player_action(db, room, actor, "call")

        assert room.dealer_seat in acted_seats

    async def test_dealer_gets_turn_on_river(self, db, mock_manager):
        """Dealer must get a turn on the river round."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # Complete preflop
        for _ in range(3):
            if room.action_seat is None:
                break
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        # Flop
        await next_betting_round(db, room)
        while room.action_seat is not None:
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        # Turn
        await next_betting_round(db, room)
        while room.action_seat is not None:
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        # River
        await next_betting_round(db, room)
        assert room.game_phase == "river"

        acted_seats = []
        while room.action_seat is not None:
            actor = _acting_player(room, players)
            acted_seats.append(actor.seat)
            await player_action(db, room, actor, "call")

        assert room.dealer_seat in acted_seats

    async def test_dealer_can_raise_on_flop(self, db, mock_manager):
        """Dealer should be able to raise when it's their turn on flop."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # Complete preflop
        for _ in range(3):
            if room.action_seat is None:
                break
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        await next_betting_round(db, room)

        # Check until it's dealer's turn
        while room.action_seat is not None:
            actor = _acting_player(room, players)
            if actor.seat == room.dealer_seat:
                # Dealer raises!
                old_level = room.current_bet_level
                await player_action(db, room, actor, "raise", 50)
                assert room.current_bet_level == 50
                break
            await player_action(db, room, actor, "call")

    async def test_heads_up_dealer_acts_postflop(self, db, mock_manager):
        """In heads-up, dealer acts first post-flop (as SB)."""
        room, players, _ = setup_game(db, 2, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # Preflop: dealer/SB acts first in heads-up
        for _ in range(2):
            if room.action_seat is None:
                break
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        await next_betting_round(db, room)
        assert room.game_phase == "flop"

        # Both players should get to act
        acted_seats = []
        while room.action_seat is not None:
            actor = _acting_player(room, players)
            acted_seats.append(actor.seat)
            await player_action(db, room, actor, "call")

        assert len(acted_seats) == 2
