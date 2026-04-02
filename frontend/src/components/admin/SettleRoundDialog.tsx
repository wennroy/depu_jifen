import { useState } from 'react';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import type { Player } from '../../stores/gameStore';
import styles from '../room/Dialog.module.css';

interface Props {
  roomCode: string;
  adminToken: string;
  players: Player[];
  currentRound: number;
  onClose: () => void;
}

export default function SettleRoundDialog({ roomCode, adminToken, players, currentRound, onClose }: Props) {
  const [deltas, setDeltas] = useState<Record<string, string>>(
    Object.fromEntries(players.map(p => [p.player_id, '0']))
  );
  const [loading, setLoading] = useState(false);

  const total = Object.values(deltas).reduce((sum, v) => sum + (parseInt(v) || 0), 0);

  const handleSettle = async () => {
    if (total !== 0) {
      Toast.show({ content: `总和必须为0，当前为 ${total > 0 ? '+' : ''}${total}` });
      return;
    }
    const settlements = Object.entries(deltas)
      .map(([player_id, val]) => ({ player_id, delta: parseInt(val) || 0 }))
      .filter(s => s.delta !== 0);

    if (settlements.length === 0) {
      Toast.show({ content: '没有需要结算的变化' });
      return;
    }

    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/settle`, { settlements }, {
        headers: { 'X-Admin-Token': adminToken },
      });
      Toast.show({ content: `第 ${currentRound} 局结算完成`, icon: 'success' });
      onClose();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '结算失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3 className={styles.title}>第 {currentRound} 局结算</h3>
        <p className={styles.subtitle}>输入每位玩家的筹码变化（赢为正，输为负）</p>

        <div className={styles.settleGrid}>
          {players.map(p => (
            <div key={p.player_id} className={styles.settleRow}>
              <span className={styles.settleUsername}>{p.username}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {p.chips}
              </span>
              <input
                className={styles.settleInput}
                type="number"
                value={deltas[p.player_id]}
                onChange={e => setDeltas({ ...deltas, [p.player_id]: e.target.value })}
                placeholder="0"
              />
            </div>
          ))}
        </div>

        <div className={`${styles.settleTotal} ${total === 0 ? styles.totalOk : styles.totalBad}`}>
          总和: {total > 0 ? '+' : ''}{total} {total === 0 ? '✓' : '✗ (必须为0)'}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button className={styles.confirmBtn} onClick={handleSettle} disabled={loading || total !== 0}>
            {loading ? '结算中...' : '确认结算'}
          </button>
        </div>
      </div>
    </div>
  );
}
