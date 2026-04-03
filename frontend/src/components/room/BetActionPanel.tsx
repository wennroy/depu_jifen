import { useState } from 'react';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import { useGameStore } from '../../stores/gameStore';
import styles from './BetActionPanel.module.css';

export default function BetActionPanel() {
  const { roomCode, playerToken, actionSeat, currentBetLevel, pot, bigBlind, players, actingForPlayerId } = useGameStore();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Find the target player (self or acting for someone)
  const targetPlayer = actingForPlayerId
    ? players.find(p => p.player_id === actingForPlayerId)
    : players.find(p => p.seat === actionSeat);

  if (!targetPlayer) return null;

  const callAmount = Math.min(currentBetLevel - targetPlayer.round_bet, targetPlayer.chips);
  const minRaise = currentBetLevel + bigBlind;

  const suggestions = [
    { label: `${minRaise}`, value: minRaise },
    { label: `2x`, value: currentBetLevel * 2 || bigBlind * 2 },
    { label: `½ Pot`, value: Math.floor(pot / 2) || bigBlind },
    { label: `Pot`, value: pot || bigBlind * 2 },
    { label: `All-in`, value: targetPlayer.chips + targetPlayer.round_bet },
  ].filter(s => s.value > currentBetLevel && s.value <= targetPlayer.chips + targetPlayer.round_bet);

  const doAction = async (action: string, amt: number = 0) => {
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/action`, {
        target_player_id: targetPlayer.player_id,
        action,
        amount: amt,
      }, { headers: { 'X-Player-Token': playerToken } });
      setAmount('');
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '操作失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  const handleRaise = () => {
    const val = parseInt(amount);
    if (!val || val <= currentBetLevel) {
      Toast.show({ content: `加注须大于 ${currentBetLevel}` });
      return;
    }
    if (val >= targetPlayer.chips + targetPlayer.round_bet) {
      doAction('allin');
    } else {
      doAction('raise', val);
    }
  };

  return (
    <div className={styles.panel}>
      {actingForPlayerId && (
        <div className={styles.actingFor}>
          帮 <strong>{targetPlayer.username}</strong> 操作
        </div>
      )}

      {/* Main actions: Fold + Call */}
      <div className={styles.mainActions}>
        <button className={styles.foldBtn} onClick={() => doAction('fold')} disabled={loading}>
          弃牌
        </button>
        {callAmount > 0 ? (
          <button className={styles.callBtn} onClick={() => doAction('call')} disabled={loading}>
            跟注 {callAmount}
          </button>
        ) : (
          <button className={styles.callBtn} onClick={() => doAction('call')} disabled={loading}>
            过牌
          </button>
        )}
      </div>

      {/* Suggested amounts */}
      <div className={styles.suggestions}>
        {suggestions.map((s, i) => (
          <button
            key={i}
            className={styles.suggestBtn}
            onClick={() => setAmount(String(s.value))}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Custom raise */}
      <div className={styles.raiseRow}>
        <input
          className={styles.input}
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={`加注 (>${currentBetLevel})`}
          min={minRaise}
        />
        <button className={styles.raiseBtn} onClick={handleRaise} disabled={loading || !amount}>
          加注
        </button>
      </div>
    </div>
  );
}
