from sqlalchemy.orm import Session

from backend.models import Room, Player, Transaction
from backend.services.ws_manager import manager

PHASE_ORDER = ["lobby", "preflop", "flop", "turn", "river", "showdown"]


def _active_players(room: Room) -> list[Player]:
    """Players in the hand: active, not folded, not sitout, not observer, seated."""
    return sorted(
        [p for p in room.players if p.is_active and not p.is_folded and p.status != "sitout" and p.role == "player" and p.seat is not None],
        key=lambda p: p.seat,
    )


def _all_seated_playing(room: Room) -> list[Player]:
    """All seated players in current hand (including folded, excluding sitout/observer)."""
    return sorted(
        [p for p in room.players if p.is_active and p.status != "sitout" and p.role == "player" and p.seat is not None],
        key=lambda p: p.seat,
    )


def _get_next_seat(room: Room, from_seat: int) -> int | None:
    """Find next active, non-folded player seat clockwise."""
    players = _active_players(room)
    players = [p for p in players if p.chips > 0]
    if not players:
        return None
    seats = [p.seat for p in players]
    after = [s for s in seats if s > from_seat]
    if after:
        return after[0]
    return seats[0]


def _get_prev_seat(room: Room, from_seat: int) -> int | None:
    """Find previous active, non-folded player seat (for round_end_seat)."""
    players = _active_players(room)
    if not players:
        return None
    seats = [p.seat for p in players]
    before = [s for s in seats if s < from_seat]
    if before:
        return before[-1]
    return seats[-1]


def _player_states_snapshot(room: Room) -> list[dict]:
    return [
        {"player_id": p.id, "username": p.username, "chips": p.chips,
         "seat": p.seat, "round_bet": p.round_bet, "hand_bet": p.hand_bet,
         "is_folded": p.is_folded, "status": p.status}
        for p in _all_seated_playing(room)
    ]


async def start_hand(db: Session, room: Room):
    """Start a new hand: reset state, post blinds, set action to UTG."""
    seated = _all_seated_playing(room)
    if len(seated) < 2:
        raise ValueError("至少需要 2 名玩家才能开始")

    for p in room.players:
        p.round_bet = 0
        p.hand_bet = 0
        p.is_folded = False

    seats = [p.seat for p in seated]
    if room.dealer_seat is None or room.dealer_seat not in seats:
        room.dealer_seat = seats[0]
    else:
        idx = seats.index(room.dealer_seat)
        room.dealer_seat = seats[(idx + 1) % len(seats)]

    dealer_idx = seats.index(room.dealer_seat)
    if len(seated) == 2:
        sb_seat = seats[dealer_idx]
        bb_seat = seats[(dealer_idx + 1) % len(seats)]
    else:
        sb_seat = seats[(dealer_idx + 1) % len(seats)]
        bb_seat = seats[(dealer_idx + 2) % len(seats)]

    sb_player = next(p for p in seated if p.seat == sb_seat)
    bb_player = next(p for p in seated if p.seat == bb_seat)

    sb_amount = min(room.small_blind, sb_player.chips)
    bb_amount = min(room.big_blind, bb_player.chips)

    sb_player.chips -= sb_amount
    sb_player.round_bet = sb_amount
    sb_player.hand_bet = sb_amount

    bb_player.chips -= bb_amount
    bb_player.round_bet = bb_amount
    bb_player.hand_bet = bb_amount

    room.pot = sb_amount + bb_amount
    room.current_bet_level = bb_amount
    room.game_phase = "preflop"
    room.current_round += 1

    # UTG = after BB
    bb_idx = seats.index(bb_seat)
    utg_seat = seats[(bb_idx + 1) % len(seats)]
    room.action_seat = utg_seat

    # Preflop: round ends at BB (BB gets last option to raise)
    room.round_end_seat = bb_seat

    db.add(Transaction(room_id=room.id, round_number=room.current_round,
                       tx_type="blind", from_player_id=sb_player.id,
                       amount=sb_amount, note=f"小盲 {sb_amount}"))
    db.add(Transaction(room_id=room.id, round_number=room.current_round,
                       tx_type="blind", from_player_id=bb_player.id,
                       amount=bb_amount, note=f"大盲 {bb_amount}"))
    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "hand_started",
        "data": {
            "round": room.current_round,
            "phase": room.game_phase,
            "dealer_seat": room.dealer_seat,
            "action_seat": room.action_seat,
            "pot": room.pot,
            "current_bet_level": room.current_bet_level,
            "players": _player_states_snapshot(room),
        },
    })


async def player_action(db: Session, room: Room, target: Player, action: str, amount: int = 0):
    """Execute a player action: call, fold, raise, allin."""
    if room.game_phase in ("lobby", "showdown"):
        raise ValueError("当前阶段不能下注")
    if target.is_folded:
        raise ValueError(f"{target.username} 已弃牌")
    if target.seat != room.action_seat:
        raise ValueError(f"当前不是 {target.username} 的回合")

    if action == "fold":
        target.is_folded = True
    elif action == "call":
        call_amount = min(room.current_bet_level - target.round_bet, target.chips)
        target.chips -= call_amount
        target.round_bet += call_amount
        target.hand_bet += call_amount
        room.pot += call_amount
    elif action == "raise":
        if amount <= room.current_bet_level:
            raise ValueError(f"加注必须大于当前下注 {room.current_bet_level}")
        raise_cost = min(amount - target.round_bet, target.chips)
        target.chips -= raise_cost
        target.round_bet += raise_cost
        target.hand_bet += raise_cost
        room.pot += raise_cost
        room.current_bet_level = target.round_bet
        # Raise resets the round closer: everyone else must respond
        # New end seat = the player just before the raiser
        room.round_end_seat = _get_prev_seat(room, target.seat)
    elif action == "allin":
        allin_amount = target.chips
        target.chips = 0
        target.round_bet += allin_amount
        target.hand_bet += allin_amount
        room.pot += allin_amount
        if target.round_bet > room.current_bet_level:
            room.current_bet_level = target.round_bet
            room.round_end_seat = _get_prev_seat(room, target.seat)
    else:
        raise ValueError(f"未知操作: {action}")

    db.add(Transaction(room_id=room.id, round_number=room.current_round,
                       tx_type=action, from_player_id=target.id,
                       amount=target.hand_bet if action != "fold" else 0,
                       note=f"{target.username} {action}" + (f" {amount}" if action == "raise" else "")))

    # Check if only one player left
    active = _active_players(room)
    if len(active) <= 1:
        room.action_seat = None
        room.game_phase = "showdown"
        db.commit()
        await _broadcast_acted(room, target, action, amount, betting_complete=True)
        return

    # If the closer just folded, advance round_end_seat to prev non-folded player
    if action == "fold" and target.seat == room.round_end_seat:
        new_closer = _get_prev_seat(room, target.seat)
        room.round_end_seat = new_closer

    # Find next player to act
    next_seat = _get_next_seat(room, target.seat)
    betting_complete = False

    # Check if betting round is complete
    active_with_chips = [p for p in active if p.chips > 0]
    all_bets_matched = (
        len(active_with_chips) <= 1
        or all(p.round_bet == room.current_bet_level for p in active_with_chips)
    )

    if all_bets_matched:
        # If the closer has already acted (next would go past them), round is done
        # OR if the closer just acted this turn
        if action != "fold" and target.seat == room.round_end_seat:
            betting_complete = True
        elif next_seat == room.round_end_seat and all_bets_matched:
            # Next player IS the closer, and they already match → check if they need to act
            closer_player = next((p for p in active if p.seat == room.round_end_seat), None)
            if closer_player and closer_player.round_bet == room.current_bet_level:
                betting_complete = True

    if betting_complete:
        room.action_seat = None
    else:
        room.action_seat = next_seat

    db.commit()
    await _broadcast_acted(room, target, action, amount, betting_complete=betting_complete)


async def _broadcast_acted(room: Room, target: Player, action: str, amount: int, betting_complete: bool):
    await manager.broadcast(room.room_code, {
        "type": "player_acted",
        "data": {
            "player_id": target.id, "action": action, "amount": amount,
            "chips": target.chips, "round_bet": target.round_bet,
            "pot": room.pot, "current_bet_level": room.current_bet_level,
            "action_seat": room.action_seat,
            "phase": room.game_phase, "betting_complete": betting_complete,
        },
    })


async def next_betting_round(db: Session, room: Room):
    """Advance to next phase (flop→turn→river→showdown)."""
    phase_idx = PHASE_ORDER.index(room.game_phase)
    if phase_idx < 1 or phase_idx >= 5:
        raise ValueError("当前阶段不能推进")

    next_phase = PHASE_ORDER[phase_idx + 1]
    room.game_phase = next_phase

    for p in room.players:
        p.round_bet = 0
    room.current_bet_level = 0

    if next_phase == "showdown":
        room.action_seat = None
        room.round_end_seat = None
    else:
        active = _active_players(room)
        active = [p for p in active if p.chips > 0]
        if len(active) <= 1:
            room.action_seat = None
            room.round_end_seat = None
            room.game_phase = "showdown"
        else:
            # Post-flop: action starts from first player after dealer
            first_seat = _get_next_seat(room, room.dealer_seat)
            room.action_seat = first_seat
            # Round ends at dealer (last to act post-flop)
            # = the player just before the first actor
            room.round_end_seat = _get_prev_seat(room, first_seat)

    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "phase_advanced",
        "data": {
            "phase": room.game_phase,
            "action_seat": room.action_seat,
            "pot": room.pot,
            "current_bet_level": 0,
            "players": _player_states_snapshot(room),
        },
    })


async def settle_hand(db: Session, room: Room, winners: list[dict]):
    """Settle: distribute pot to winners."""
    if room.game_phase != "showdown":
        raise ValueError("只能在 showdown 阶段结算")

    total_distributed = sum(w["amount"] for w in winners)
    if total_distributed != room.pot:
        raise ValueError(f"分配金额 {total_distributed} 不等于底池 {room.pot}")

    results = []
    for w in winners:
        player = next((p for p in room.players if p.id == w["player_id"]), None)
        if not player:
            raise ValueError(f"玩家不存在: {w['player_id']}")
        player.chips += w["amount"]
        results.append({"player_id": player.id, "username": player.username,
                        "amount": w["amount"], "chips": player.chips})
        db.add(Transaction(room_id=room.id, round_number=room.current_round,
                           tx_type="win", to_player_id=player.id,
                           amount=w["amount"], note=f"{player.username} 赢得 {w['amount']}"))

    room.game_phase = "lobby"
    room.pot = 0
    room.current_bet_level = 0
    room.action_seat = None
    room.round_end_seat = None
    for p in room.players:
        p.round_bet = 0
        p.hand_bet = 0
        p.is_folded = False

    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "hand_settled",
        "data": {
            "winners": results,
            "round": room.current_round,
            "players": _player_states_snapshot(room),
        },
    })


async def set_away(db: Session, room: Room, player: Player, away: bool):
    """Toggle sitout status. away=True → sitout, away=False → online."""
    player.status = "sitout" if away else "online"
    db.commit()
    await manager.broadcast(room.room_code, {
        "type": "player_status",
        "data": {"player_id": player.id, "username": player.username, "status": player.status},
    })
