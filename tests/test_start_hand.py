"""Tests for game_service: start_hand."""
import pytest
from backend.services.game_service import start_hand
from tests.conftest import setup_game


@pytest.mark.asyncio
class TestStartHand:
    async def test_minimum_two_players(self, db, mock_manager):
        """Starting a hand with <2 players raises ValueError."""
        from tests.conftest import make_user, make_room
        user = make_user(db, "solo")
        room = make_room(db, user)
        with pytest.raises(ValueError, match="至少需要 2 名玩家"):
            await start_hand(db, room)

    async def test_basic_start(self, db, mock_manager):
        """Starting a hand with 3 players sets up correctly."""
        room, players, _ = setup_game(db, 3)
        await start_hand(db, room)

        assert room.game_phase == "preflop"
        assert room.current_round == 1
        assert room.dealer_seat is not None
        assert room.action_seat is not None
        assert room.pot == room.small_blind + room.big_blind

    async def test_dealer_rotation(self, db, mock_manager):
        """Dealer rotates on each new hand."""
        room, players, _ = setup_game(db, 3)

        await start_hand(db, room)
        first_dealer = room.dealer_seat

        # Settle and start another
        room.game_phase = "lobby"
        room.pot = 0
        for p in players:
            p.round_bet = 0
            p.hand_bet = 0
            p.is_folded = False
            p.chips = 1000
        db.commit()

        await start_hand(db, room)
        second_dealer = room.dealer_seat
        assert second_dealer != first_dealer

    async def test_heads_up_blinds(self, db, mock_manager):
        """In heads-up, dealer posts SB."""
        room, players, _ = setup_game(db, 2, small_blind=5, big_blind=10)
        await start_hand(db, room)

        dealer = next(p for p in players if p.seat == room.dealer_seat)
        other = next(p for p in players if p.seat != room.dealer_seat)

        # Dealer = SB, other = BB
        assert dealer.round_bet == 5
        assert other.round_bet == 10
        assert room.pot == 15

    async def test_three_player_blinds(self, db, mock_manager):
        """With 3+ players, SB is left of dealer, BB is next."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        seats = sorted([p.seat for p in players])
        d_idx = seats.index(room.dealer_seat)
        sb_seat = seats[(d_idx + 1) % 3]
        bb_seat = seats[(d_idx + 2) % 3]

        sb_player = next(p for p in players if p.seat == sb_seat)
        bb_player = next(p for p in players if p.seat == bb_seat)
        assert sb_player.round_bet == 5
        assert bb_player.round_bet == 10

    async def test_utg_action(self, db, mock_manager):
        """UTG (after BB) is first to act preflop."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        seats = sorted([p.seat for p in players])
        d_idx = seats.index(room.dealer_seat)
        bb_seat = seats[(d_idx + 2) % 3]
        utg_seat = seats[(seats.index(bb_seat) + 1) % 3]
        assert room.action_seat == utg_seat

    async def test_short_stack_blind(self, db, mock_manager):
        """Player with fewer chips than blind posts what they have."""
        room, players, _ = setup_game(db, 2, small_blind=5, big_blind=10)
        # Give one player only 3 chips
        players[0].chips = 3
        players[1].chips = 1000
        db.commit()

        await start_hand(db, room)

        dealer = next(p for p in players if p.seat == room.dealer_seat)
        if dealer.chips == 0:
            # Dealer was SB and had 3 chips, posted 3
            assert dealer.round_bet == 3
        # Pot should reflect actual blind amounts
        assert room.pot > 0

    async def test_round_end_seat_preflop(self, db, mock_manager):
        """Preflop: round_end_seat should be BB."""
        room, players, _ = setup_game(db, 3, small_blind=5, big_blind=10)
        await start_hand(db, room)

        seats = sorted([p.seat for p in players])
        d_idx = seats.index(room.dealer_seat)
        bb_seat = seats[(d_idx + 2) % 3]
        assert room.round_end_seat == bb_seat

    async def test_broadcast_sent(self, db, mock_manager):
        """start_hand broadcasts hand_started event."""
        room, players, _ = setup_game(db, 2)
        await start_hand(db, room)
        assert any(c["message"]["type"] == "hand_started" for c in mock_manager)
