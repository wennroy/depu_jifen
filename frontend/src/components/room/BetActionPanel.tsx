import { useState } from 'react';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import { useUser } from '../../contexts/UserContext';
import { useGameStore } from '../../stores/gameStore';
import styles from './BetActionPanel.module.css';

export default function BetActionPanel() {
  const { user } = useUser();
  const { roomCode, actionSeat, currentBetLevel, pot, bigBlind, players, playerId } = useGameStore();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const myPlayer = players.find(p => p.player_id === playerId);
  if (!myPlayer || myPlayer.seat !== actionSeat) return null;

  const callAmount = Math.min(currentBetLevel - myPlayer.round_bet, myPlayer.chips);
  const minRaise = currentBetLevel + bigBlind;

  const suggestions = [
    { label: `${minRaise}`, value: minRaise },
    { label: `2x`, value: (currentBetLevel || bigBlind) * 2 },
    { label: `½Pot`, value: Math.floor(pot / 2) || bigBlind },
    { label: `Pot`, value: pot || bigBlind * 2 },
    { label: `All-in`, value: myPlayer.chips + myPlayer.round_bet },
  ].filter(s => s.value > currentBetLevel && s.value <= myPlayer.chips + myPlayer.round_bet);

  const doAction = async (action: string, amt: number = 0) => {
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/action`, {
        target_player_id: myPlayer.player_id, action, amount: amt,
      }, { headers: { 'X-User-Token': user?.userToken || '' } });
      setAmount('');
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '操作失败', icon: 'fail' });
    } finally { setLoading(false); }
  };

  const handleRaise = () => {
    const val = parseInt(amount);
    if (!val || val <= currentBetLevel) { Toast.show({ content: `加注须大于 ${currentBetLevel}` }); return; }
    if (val >= myPlayer.chips + myPlayer.round_bet) doAction('allin');
    else doAction('raise', val);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.mainActions}>
        <button className={styles.foldBtn} onClick={() => doAction('fold')} disabled={loading}>弃牌</button>
        <button className={styles.callBtn} onClick={() => doAction('call')} disabled={loading}>
          {callAmount > 0 ? `跟注 ${callAmount}` : '过牌'}
        </button>
      </div>
      <div className={styles.suggestions}>
        {suggestions.map((s, i) => (
          <button key={i} className={styles.suggestBtn} onClick={() => setAmount(String(s.value))}>{s.label}</button>
        ))}
      </div>
      <div className={styles.raiseRow}>
        <input className={styles.input} type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder={`加注 (>${currentBetLevel})`} min={minRaise} />
        <button className={styles.raiseBtn} onClick={handleRaise} disabled={loading || !amount}>加注</button>
      </div>
    </div>
  );
}
