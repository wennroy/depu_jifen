"""Tests for chip_service: transfer, rebuy, adjust, bet."""
import pytest
from backend.services.chip_service import place_bet, transfer_chips, adjust_chips
from tests.conftest import setup_game, make_user, make_room, add_player


@pytest.mark.asyncio
class TestPlaceBet:
    async def test_basic_bet(self, db, mock_manager):
        room, players, _ = setup_game(db, 2)
        player = players[0]
        old_chips = player.chips
        await place_bet(db, player, 100)
        assert player.chips == old_chips - 100

    async def test_bet_insufficient_chips(self, db, mock_manager):
        room, players, _ = setup_game(db, 2)
        player = players[0]
        with pytest.raises(ValueError, match="筹码不足"):
            await place_bet(db, player, player.chips + 1)


@pytest.mark.asyncio
class TestTransferChips:
    async def test_basic_transfer(self, db, mock_manager):
        room, players, _ = setup_game(db, 2)
        sender, receiver = players[0], players[1]
        old_sender = sender.chips
        old_receiver = receiver.chips
        await transfer_chips(db, sender, receiver, 200)
        assert sender.chips == old_sender - 200
        assert receiver.chips == old_receiver + 200

    async def test_self_transfer(self, db, mock_manager):
        room, players, _ = setup_game(db, 2)
        with pytest.raises(ValueError, match="不能给自己转账"):
            await transfer_chips(db, players[0], players[0], 100)

    async def test_transfer_insufficient(self, db, mock_manager):
        room, players, _ = setup_game(db, 2)
        with pytest.raises(ValueError, match="筹码不足"):
            await transfer_chips(db, players[0], players[1], players[0].chips + 1)

    async def test_transfer_to_inactive(self, db, mock_manager):
        room, players, _ = setup_game(db, 2)
        players[1].is_active = False
        db.commit()
        with pytest.raises(ValueError, match="目标玩家不在房间中"):
            await transfer_chips(db, players[0], players[1], 100)


@pytest.mark.asyncio
class TestAdjustChips:
    async def test_add_chips(self, db, mock_manager):
        room, players, _ = setup_game(db, 2)
        old = players[0].chips
        await adjust_chips(db, room, players[0], 500, "bonus")
        assert players[0].chips == old + 500

    async def test_remove_chips(self, db, mock_manager):
        room, players, _ = setup_game(db, 2)
        old = players[0].chips
        await adjust_chips(db, room, players[0], -100, "penalty")
        assert players[0].chips == old - 100

    async def test_negative_chips_error(self, db, mock_manager):
        room, players, _ = setup_game(db, 2)
        with pytest.raises(ValueError, match="筹码不能为负数"):
            await adjust_chips(db, room, players[0], -(players[0].chips + 1), "")
