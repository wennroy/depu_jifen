"""Tests for complex multi-hand and edge-case scenarios."""
import pytest
from backend.services.game_service import (
    start_hand, player_action, next_betting_round, settle_hand, set_away, abort_hand,
)
from tests.conftest import setup_game


def _acting_player(room, players):
    return next(p for p in players if p.seat == room.action_seat)


async def _complete_round_checks(db, room, players):
    """Everyone checks/calls through the current round."""
    for _ in range(len(players) + 1):
        if room.action_seat is None:
            break
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "call")


@pytest.mark.asyncio
class TestMultipleHands:
    async def test_two_consecutive_hands(self, db, mock_manager):
        """Play two full hands to verify state resets properly."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)

        # Hand 1
        await start_hand(db, room)
        assert room.current_round == 1
        dealer1 = room.dealer_seat

        # Everyone calls preflop
        await _complete_round_checks(db, room, players)
        # Advance to showdown
        for _ in range(4):
            await next_betting_round(db, room)
            if room.game_phase == "showdown":
                break
            await _complete_round_checks(db, room, players)

        pot = room.pot
        await settle_hand(db, room, [{"player_id": players[0].id, "amount": pot}])
        assert room.game_phase == "lobby"

        # Hand 2
        await start_hand(db, room)
        assert room.current_round == 2
        assert room.dealer_seat != dealer1  # Dealer rotated

    async def test_chips_persist_across_hands(self, db, mock_manager):
        """Chips won/lost carry over to the next hand."""
        room, players, _ = setup_game(db, 2, small_blind=5, big_blind=10)

        await start_hand(db, room)
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "fold")

        pot = room.pot
        winner = next(p for p in players if not p.is_folded)
        loser = next(p for p in players if p.is_folded)
        old_winner_chips = winner.chips
        await settle_hand(db, room, [{"player_id": winner.id, "amount": pot}])

        assert winner.chips == old_winner_chips + pot
        total = sum(p.chips for p in players)
        assert total == 2000  # Total chips unchanged


@pytest.mark.asyncio
class TestEdgeCases:
    async def test_wrong_player_action(self, db, mock_manager):
        """Player not at action_seat can't act."""
        room, players, _ = setup_game(db, 3)
        await start_hand(db, room)
        non_actor = next(p for p in players if p.seat != room.action_seat and not p.is_folded)
        with pytest.raises(ValueError, match="不是.*的回合"):
            await player_action(db, room, non_actor, "call")

    async def test_folded_player_cant_act(self, db, mock_manager):
        """A folded player can't take actions."""
        room, players, _ = setup_game(db, 3)
        await start_hand(db, room)
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "fold")
        with pytest.raises(ValueError):
            await player_action(db, room, actor, "call")

    async def test_lobby_phase_no_action(self, db, mock_manager):
        """Can't take actions in lobby phase."""
        room, players, _ = setup_game(db, 3)
        with pytest.raises(ValueError, match="当前阶段不能下注"):
            await player_action(db, room, players[0], "call")

    async def test_set_away(self, db, mock_manager):
        """Player can go AFK and come back."""
        room, players, _ = setup_game(db, 3)
        await set_away(db, room, players[0], True)
        assert players[0].status == "sitout"
        await set_away(db, room, players[0], False)
        assert players[0].status == "online"

    async def test_sitout_excluded_from_hand(self, db, mock_manager):
        """Sitout player shouldn't be dealt into the hand."""
        room, players, _ = setup_game(db, 3)
        players[2].status = "sitout"
        db.commit()

        await start_hand(db, room)
        # Only 2 players should be in the hand (players[0] and players[1])
        # action_seat should only cycle between non-sitout players
        acted_seats = set()
        for _ in range(5):
            if room.action_seat is None:
                break
            actor = _acting_player(room, players)
            acted_seats.add(actor.seat)
            await player_action(db, room, actor, "call")

        assert players[2].seat not in acted_seats


@pytest.mark.asyncio
class TestAbortHand:
    async def test_abort_returns_blinds(self, db, mock_manager):
        """Aborting right after start returns blind bets."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        chips_before = [p.chips for p in players]
        await start_hand(db, room)
        await abort_hand(db, room)

        assert room.game_phase == "lobby"
        assert room.pot == 0
        # All chips restored
        for p, before in zip(players, chips_before):
            assert p.chips == before

    async def test_abort_returns_all_bets(self, db, mock_manager):
        """Aborting mid-hand returns all bets to players."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # UTG raises to 30
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "raise", 30)
        # SB calls
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "call")

        total_before = sum(p.chips for p in players)
        pot = room.pot
        await abort_hand(db, room)

        assert room.game_phase == "lobby"
        assert room.pot == 0
        total_after = sum(p.chips for p in players)
        assert total_after == total_before + pot

    async def test_abort_resets_state(self, db, mock_manager):
        """Abort resets action_seat, round_end_seat, folds, etc."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        actor = _acting_player(room, players)
        await player_action(db, room, actor, "fold")
        await abort_hand(db, room)

        assert room.action_seat is None
        assert room.round_end_seat is None
        for p in players:
            assert not p.is_folded
            assert p.round_bet == 0
            assert p.hand_bet == 0

    async def test_abort_in_lobby_raises(self, db, mock_manager):
        """Can't abort when no hand is in progress."""
        room, players, _ = setup_game(db, 3)
        with pytest.raises(ValueError, match="没有进行中的对局"):
            await abort_hand(db, room)

    async def test_can_start_new_hand_after_abort(self, db, mock_manager):
        """After aborting, a new hand can be started."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)
        await abort_hand(db, room)
        await start_hand(db, room)
        assert room.game_phase == "preflop"

    async def test_abort_broadcasts_message(self, db, mock_manager):
        """Abort should broadcast hand_aborted message."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)
        await abort_hand(db, room)

        abort_msgs = [c for c in mock_manager if c["message"]["type"] == "hand_aborted"]
        assert len(abort_msgs) == 1
        data = abort_msgs[0]["message"]["data"]
        assert "players" in data


@pytest.mark.asyncio
class TestReRaiseScenario:
    async def test_reraise_extends_action(self, db, mock_manager):
        """A re-raise should allow all players to respond again."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # UTG raises to 30
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "raise", 30)
        assert room.action_seat is not None

        # Next player re-raises to 60
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "raise", 60)
        assert room.action_seat is not None
        assert room.current_bet_level == 60

        # Everyone should still need to act
        # The original raiser needs to respond to the re-raise
        acted = 0
        while room.action_seat is not None and acted < 10:
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")
            acted += 1

        assert acted >= 2  # At least BB and UTG need to respond


@pytest.mark.asyncio
class TestAllInScenarios:
    async def test_all_players_allin(self, db, mock_manager):
        """When all players go all-in, game should proceed to showdown."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        while room.action_seat is not None:
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "allin")

        # After all players all-in, should be able to advance to showdown
        while room.game_phase != "showdown":
            await next_betting_round(db, room)

        assert room.game_phase == "showdown"

    async def test_allin_less_than_current_bet(self, db, mock_manager):
        """All-in for less than current bet level doesn't change the level."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        # UTG raises to 500
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "raise", 500)

        # Next player has only 100 chips total (set manually)
        actor = _acting_player(room, players)
        actor.chips = 90  # 90 + round_bet(0) = 90, less than 500
        db.commit()
        await player_action(db, room, actor, "allin")

        # Bet level stays at 500, not lowered to 90
        assert room.current_bet_level == 500

    async def test_postflop_with_allin_player(self, db, mock_manager):
        """All-in player from preflop shouldn't block postflop rounds."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10,
                                      initial_chips=100)
        await start_hand(db, room)

        # UTG goes all-in
        actor = _acting_player(room, players)
        await player_action(db, room, actor, "allin")

        # Others call
        while room.action_seat is not None:
            actor = _acting_player(room, players)
            await player_action(db, room, actor, "call")

        # Advance through rounds
        rounds_played = 0
        while room.game_phase != "showdown" and rounds_played < 5:
            await next_betting_round(db, room)
            rounds_played += 1
            if room.game_phase == "showdown":
                break
            # Remaining players with chips should still act
            await _complete_round_checks(db, room, players)

        assert room.game_phase == "showdown"
