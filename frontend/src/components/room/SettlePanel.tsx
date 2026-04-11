import { useState, useEffect } from 'react';
import { Toast } from 'antd-mobile';
import { Trophy } from 'lucide-react';
import http from '../../api/http';
import type { Player } from '../../stores/gameStore';
import styles from './SettlePanel.module.css';

interface Props {
  roomCode: string;
  playerToken: string;
  pot: number;
  players: Player[];
  onSettled: () => void;
}

export default function SettlePanel({ roomCode, playerToken, pot, players, onSettled }: Props) {
  const activePlayers = players.filter(p => p.is_active && !p.is_folded);
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(activePlayers.map(p => [p.player_id, '0']))
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const newActive = players.filter(p => p.is_active && !p.is_folded);
    setAmounts(prev => Object.fromEntries(
      newActive.map(p => [p.player_id, prev[p.player_id] ?? '0'])
    ));
  }, [players]);

  const total = Object.values(amounts).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  const remaining = pot - total;

  // Quick: give all to one player
  const giveAll = (playerId: string) => {
    setAmounts(Object.fromEntries(
      Object.keys(amounts).map(id => [id, id === playerId ? String(pot) : '0'])
    ));
  };

  const handleSettle = async () => {
    if (remaining !== 0) {
      Toast.show({ content: `还剩 ${remaining} 未分配` });
      return;
    }
    const winners = Object.entries(amounts)
      .filter(([, v]) => parseInt(v) > 0)
      .map(([player_id, amount]) => ({ player_id, amount: parseInt(amount) }));

    if (winners.length === 0) {
      Toast.show({ content: '请选择赢家' });
      return;
    }

    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/settle-hand`, { winners }, {
        headers: { 'X-User-Token': playerToken },
      });
      Toast.show({ content: '结算完成', icon: 'success' });
      onSettled();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '结算失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <Trophy size={18} className={styles.icon} />
        <span className={styles.title}>结算 — 底池 {pot}</span>
      </div>

      <div className={styles.hint}>点击玩家名「全拿」或手动分配</div>

      <div className={styles.list}>
        {activePlayers.map(p => (
          <div key={p.player_id} className={styles.row}>
            <button className={styles.nameBtn} onClick={() => giveAll(p.player_id)}>
              {p.username}
            </button>
            <input
              className={styles.input}
              type="number"
              value={amounts[p.player_id]}
              onChange={e => setAmounts({ ...amounts, [p.player_id]: e.target.value })}
              min={0}
              max={pot}
            />
          </div>
        ))}
      </div>

      <div className={`${styles.remaining} ${remaining === 0 ? styles.ok : styles.bad}`}>
        {remaining === 0 ? '分配完毕 ✓' : `剩余 ${remaining}`}
      </div>

      <button className={styles.settleBtn} onClick={handleSettle} disabled={loading || remaining !== 0}>
        {loading ? '结算中...' : '确认结算'}
      </button>
    </div>
  );
}
