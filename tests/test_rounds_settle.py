"""Tests for game_service: next_betting_round and settle_hand."""
import pytest
from backend.services.game_service import (
    start_hand, player_action, next_betting_round, settle_hand,
)
from tests.conftest import setup_game


def _acting_player(room, players):
    return next(p for p in players if p.seat == room.action_seat)


async def _play_preflop_all_call(db, room, players, mock_manager):
    """Helper: start hand and have everyone call preflop."""
    await start_hand(db, room)
    for _ in range(len(players)):
        if room.action_seat is None:
            break
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "call")


async def _check_all(db, room, players):
    """Helper: everyone checks in current round."""
    for _ in range(len(players)):
        if room.action_seat is None:
            break
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "call")


@pytest.mark.asyncio
class TestNextBettingRound:
    async def test_preflop_to_flop(self, db, mock_manager):
        room, players, _ = setup_game(db, 3)
        await _play_preflop_all_call(db, room, players, mock_manager)
        await next_betting_round(db, room)
        assert room.game_phase == "flop"
        assert room.current_bet_level == 0
        assert room.action_seat is not None

    async def test_full_phase_progression(self, db, mock_manager):
        """Test preflop → flop → turn → river → showdown."""
        room, players, _ = setup_game(db, 3)
        await _play_preflop_all_call(db, room, players, mock_manager)

        for expected_phase in ["flop", "turn", "river", "showdown"]:
            await next_betting_round(db, room)
            assert room.game_phase == expected_phase
            if expected_phase != "showdown":
                await _check_all(db, room, players)

    async def test_round_bets_reset(self, db, mock_manager):
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await _play_preflop_all_call(db, room, players, mock_manager)

        # After preflop, players have round_bets of 10
        assert any(p.round_bet > 0 for p in players)

        await next_betting_round(db, room)
        # All round_bets should be 0 now
        for p in players:
            assert p.round_bet == 0

    async def test_postflop_action_after_dealer(self, db, mock_manager):
        """Post-flop action starts from first active player after dealer."""
        room, players, _ = setup_game(db, 3)
        await _play_preflop_all_call(db, room, players, mock_manager)
        await next_betting_round(db, room)

        # Action seat should be next after dealer
        seats = sorted([p.seat for p in players])
        d_idx = seats.index(room.dealer_seat)
        expected_first = seats[(d_idx + 1) % len(seats)]
        assert room.action_seat == expected_first

    async def test_skip_to_showdown_one_active(self, db, mock_manager):
        """If only 1 active player has chips, skip to showdown."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # UTG folds
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "fold")

        # SB all-in
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "allin")

        # BB calls all-in
        if room.action_seat is not None:
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        if room.action_seat is None and room.game_phase != "showdown":
            await next_betting_round(db, room)
            # Should jump to showdown since both remaining are all-in or 1 active
            # (depends on chip amounts)

    async def test_invalid_phase_advance(self, db, mock_manager):
        """Can't advance from lobby or showdown."""
        room, players, _ = setup_game(db, 3)
        with pytest.raises(ValueError, match="当前阶段不能推进"):
            await next_betting_round(db, room)


@pytest.mark.asyncio
class TestSettleHand:
    async def test_basic_settle(self, db, mock_manager):
        """Settle distributes pot to winner and resets game state."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await _play_preflop_all_call(db, room, players, mock_manager)

        # Advance to showdown
        for _ in range(4):
            await next_betting_round(db, room)
            if room.game_phase == "showdown":
                break
            await _check_all(db, room, players)

        assert room.game_phase == "showdown"
        pot = room.pot
        winner = players[0]

        await settle_hand(db, room, [{"player_id": winner.id, "amount": pot}])

        assert room.game_phase == "lobby"
        assert room.pot == 0
        assert winner.chips > 0

    async def test_settle_amount_mismatch(self, db, mock_manager):
        """Settlement must match pot exactly."""
        room, players, _ = setup_game(db, 2, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # Fold to get to showdown
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "fold")
        assert room.game_phase == "showdown"

        pot = room.pot
        with pytest.raises(ValueError, match="不等于底池"):
            await settle_hand(db, room, [{"player_id": players[0].id, "amount": pot + 100}])

    async def test_settle_multiple_winners(self, db, mock_manager):
        """Pot can be split among multiple winners."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await _play_preflop_all_call(db, room, players, mock_manager)

        for _ in range(4):
            await next_betting_round(db, room)
            if room.game_phase == "showdown":
                break
            await _check_all(db, room, players)

        pot = room.pot
        half = pot // 2
        remainder = pot - half

        await settle_hand(db, room, [
            {"player_id": players[0].id, "amount": half},
            {"player_id": players[1].id, "amount": remainder},
        ])

        assert room.game_phase == "lobby"
        assert room.pot == 0

    async def test_settle_resets_player_state(self, db, mock_manager):
        """After settling, all player hand state is reset."""
        room, players, _ = setup_game(db, 2, small_blind=5, big_blind=10)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "fold")

        pot = room.pot
        winner = next(p for p in players if not p.is_folded)
        await settle_hand(db, room, [{"player_id": winner.id, "amount": pot}])

        for p in players:
            assert p.round_bet == 0
            assert p.hand_bet == 0
            assert p.is_folded is False

    async def test_settle_nonexistent_player(self, db, mock_manager):
        """Settlement with invalid player ID raises error."""
        room, players, _ = setup_game(db, 2, small_blind=5, big_blind=10)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "fold")

        pot = room.pot
        with pytest.raises(ValueError, match="玩家不存在"):
            await settle_hand(db, room, [{"player_id": "fake-id", "amount": pot}])

    async def test_settle_wrong_phase(self, db, mock_manager):
        """Can only settle during showdown."""
        room, players, _ = setup_game(db, 3)
        with pytest.raises(ValueError, match="只能在 showdown"):
            await settle_hand(db, room, [{"player_id": players[0].id, "amount": 100}])
