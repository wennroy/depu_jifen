from sqlalchemy.orm import Session

from backend.models import Room, Player, Transaction
from backend.services.ws_manager import manager

PHASE_ORDER = ["lobby", "preflop", "flop", "turn", "river", "showdown"]


def _active_players(room: Room) -> list[Player]:
    """Players in the hand: active, not folded, seated."""
    return sorted(
        [p for p in room.players if p.is_active and not p.is_folded and p.seat is not None],
        key=lambda p: p.seat,
    )


def _all_seated_active(room: Room) -> list[Player]:
    """All active seated players (including folded)."""
    return sorted(
        [p for p in room.players if p.is_active and p.seat is not None],
        key=lambda p: p.seat,
    )


def _get_next_seat(room: Room, from_seat: int) -> int | None:
    """Find next active, non-folded, non-away player seat clockwise."""
    players = _active_players(room)
    players = [p for p in players if not p.is_away and p.chips > 0]
    if not players:
        return None
    seats = [p.seat for p in players]
    # Find first seat > from_seat, then wrap around
    after = [s for s in seats if s > from_seat]
    if after:
        return after[0]
    return seats[0]  # wrap around


def _is_round_complete(room: Room) -> bool:
    """Check if all non-folded players have matched the current bet level."""
    active = _active_players(room)
    active_with_chips = [p for p in active if p.chips > 0]  # all-in players are done
    if len(active_with_chips) <= 1:
        return True
    return all(p.round_bet == room.current_bet_level for p in active_with_chips)


def _player_states_snapshot(room: Room) -> list[dict]:
    return [
        {"player_id": p.id, "username": p.username, "chips": p.chips,
         "seat": p.seat, "round_bet": p.round_bet, "hand_bet": p.hand_bet,
         "is_folded": p.is_folded, "is_away": p.is_away}
        for p in _all_seated_active(room)
    ]


async def start_hand(db: Session, room: Room):
    """Start a new hand: reset state, post blinds, set action to UTG."""
    seated = _all_seated_active(room)
    if len(seated) < 2:
        raise ValueError("至少需要 2 名玩家才能开始")

    # Reset per-hand state
    for p in room.players:
        p.round_bet = 0
        p.hand_bet = 0
        p.is_folded = False

    # Advance dealer
    seats = [p.seat for p in seated]
    if room.dealer_seat is None or room.dealer_seat not in seats:
        room.dealer_seat = seats[0]
    else:
        idx = seats.index(room.dealer_seat)
        room.dealer_seat = seats[(idx + 1) % len(seats)]

    # Find SB and BB seats
    dealer_idx = seats.index(room.dealer_seat)
    if len(seated) == 2:
        # Heads-up: dealer is SB
        sb_seat = seats[dealer_idx]
        bb_seat = seats[(dealer_idx + 1) % len(seats)]
    else:
        sb_seat = seats[(dealer_idx + 1) % len(seats)]
        bb_seat = seats[(dealer_idx + 2) % len(seats)]

    # Post blinds
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

    # UTG is the player after BB
    bb_idx = seats.index(bb_seat)
    utg_seat = seats[(bb_idx + 1) % len(seats)]
    room.action_seat = utg_seat

    # Record blind transactions
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
    elif action == "allin":
        allin_amount = target.chips
        target.chips = 0
        target.round_bet += allin_amount
        target.hand_bet += allin_amount
        room.pot += allin_amount
        if target.round_bet > room.current_bet_level:
            room.current_bet_level = target.round_bet
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
        await manager.broadcast(room.room_code, {
            "type": "player_acted",
            "data": {
                "player_id": target.id, "action": action, "amount": amount,
                "chips": target.chips, "round_bet": target.round_bet,
                "pot": room.pot, "action_seat": None,
                "phase": room.game_phase, "betting_complete": True,
            },
        })
        return

    # Advance turn
    next_seat = _get_next_seat(room, target.seat)
    betting_complete = False

    if action != "fold" and _is_round_complete(room):
        room.action_seat = None
        betting_complete = True
    else:
        room.action_seat = next_seat

    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "player_acted",
        "data": {
            "player_id": target.id, "action": action, "amount": amount,
            "chips": target.chips, "round_bet": target.round_bet,
            "pot": room.pot, "action_seat": room.action_seat,
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

    # Reset round bets but keep pot
    for p in room.players:
        p.round_bet = 0
    room.current_bet_level = 0

    if next_phase == "showdown":
        room.action_seat = None
    else:
        # Action starts from first active player after dealer
        active = _active_players(room)
        active = [p for p in active if p.chips > 0]
        if len(active) <= 1:
            room.action_seat = None
            room.game_phase = "showdown"
        else:
            first_seat = _get_next_seat(room, room.dealer_seat)
            room.action_seat = first_seat

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
    """Settle: distribute pot to winners. winners = [{player_id, amount}]."""
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

    # Reset to lobby
    room.game_phase = "lobby"
    room.pot = 0
    room.current_bet_level = 0
    room.action_seat = None
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
    player.is_away = away
    db.commit()
    await manager.broadcast(room.room_code, {
        "type": "player_away",
        "data": {"player_id": player.id, "username": player.username, "is_away": away},
    })
