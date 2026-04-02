from sqlalchemy.orm import Session

from backend.models import Player, Room, Transaction
from backend.services.ws_manager import manager


async def place_bet(db: Session, player: Player, amount: int):
    if player.chips < amount:
        raise ValueError("筹码不足")

    player.chips -= amount
    tx = Transaction(
        room_id=player.room_id,
        round_number=player.room.current_round,
        tx_type="bet",
        from_player_id=player.id,
        amount=amount,
        note=f"第 {player.room.current_round} 局下注",
    )
    db.add(tx)
    db.commit()

    await manager.broadcast(player.room.room_code, {
        "type": "chips_updated",
        "data": {
            "player_id": player.id,
            "username": player.username,
            "chips": player.chips,
            "delta": -amount,
            "reason": f"下注 {amount}",
        },
    })


async def settle_round(db: Session, room: Room, settlements: list[dict]):
    total = sum(s["delta"] for s in settlements)
    if total != 0:
        raise ValueError(f"结算总和必须为0，当前为 {total}")

    results = []
    for s in settlements:
        if s["delta"] == 0:
            continue
        player = db.query(Player).filter(Player.id == s["player_id"]).first()
        if not player or player.room_id != room.id:
            raise ValueError(f"玩家不存在: {s['player_id']}")

        player.chips += s["delta"]
        if player.chips < 0:
            raise ValueError(f"{player.username} 筹码不能为负数")

        tx = Transaction(
            room_id=room.id,
            round_number=room.current_round,
            tx_type="settle",
            to_player_id=player.id if s["delta"] > 0 else None,
            from_player_id=player.id if s["delta"] < 0 else None,
            amount=abs(s["delta"]),
            note=f"第 {room.current_round} 局结算",
        )
        db.add(tx)
        results.append({
            "player_id": player.id,
            "username": player.username,
            "delta": s["delta"],
            "new_chips": player.chips,
        })

    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "round_settled",
        "data": {"round": room.current_round, "settlements": results},
    })


async def transfer_chips(db: Session, sender: Player, receiver: Player, amount: int):
    if sender.id == receiver.id:
        raise ValueError("不能给自己转账")
    if sender.chips < amount:
        raise ValueError("筹码不足")
    if not receiver.is_active:
        raise ValueError("目标玩家不在房间中")

    sender.chips -= amount
    receiver.chips += amount

    tx = Transaction(
        room_id=sender.room_id,
        tx_type="transfer",
        from_player_id=sender.id,
        to_player_id=receiver.id,
        amount=amount,
        note=f"{sender.username} → {receiver.username}",
    )
    db.add(tx)
    db.commit()

    await manager.broadcast(sender.room.room_code, {
        "type": "transfer",
        "data": {
            "from": {"player_id": sender.id, "username": sender.username, "chips": sender.chips},
            "to": {"player_id": receiver.id, "username": receiver.username, "chips": receiver.chips},
            "amount": amount,
        },
    })


async def adjust_chips(db: Session, room: Room, player: Player, amount: int, note: str):
    player.chips += amount
    if player.chips < 0:
        raise ValueError(f"{player.username} 筹码不能为负数")

    tx = Transaction(
        room_id=room.id,
        tx_type="adjust",
        to_player_id=player.id if amount > 0 else None,
        from_player_id=player.id if amount < 0 else None,
        amount=abs(amount),
        note=note or ("管理员增加筹码" if amount > 0 else "管理员扣除筹码"),
    )
    db.add(tx)
    db.commit()

    await manager.broadcast(room.room_code, {
        "type": "chips_updated",
        "data": {
            "player_id": player.id,
            "username": player.username,
            "chips": player.chips,
            "delta": amount,
            "reason": note or "管理员调整",
        },
    })
