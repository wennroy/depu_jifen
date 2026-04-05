import { useState } from 'react';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import type { Player } from '../../stores/gameStore';
import styles from '../room/Dialog.module.css';

interface Props {
  roomCode: string;
  adminToken: string;
  existingPlayers: Player[];
  onClose: () => void;
}

function getNextSeat(players: Player[]): number {
  const taken = new Set(players.map(p => p.seat).filter((s): s is number => s !== null));
  let next = 1;
  while (taken.has(next)) next++;
  return next;
}

export default function PreassignDialog({ roomCode, adminToken, existingPlayers, onClose }: Props) {
  const [username, setUsername] = useState('');
  const [seat, setSeat] = useState(() => String(getNextSeat(existingPlayers)));
  const [chips, setChips] = useState('');
  const [loading, setLoading] = useState(false);

  const takenSeats = existingPlayers.filter(p => p.seat).map(p => p.seat);

  const handleAdd = async () => {
    if (!username.trim()) {
      Toast.show({ content: '请输入玩家昵称' });
      return;
    }
    const seatNum = parseInt(seat) || getNextSeat(existingPlayers);
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/invite`, {
        username: username.trim(),
        seat: seatNum,
        chips: chips ? parseInt(chips) : undefined,
      }, { headers: { 'X-User-Token': adminToken } });
      Toast.show({ content: `已添加 ${username.trim()} → 座位 ${seatNum}`, icon: 'success' });
      // Reset for next player, auto-increment seat
      setUsername('');
      setSeat(String(getNextSeat([...existingPlayers, { seat: seatNum } as Player])));
      setChips('');
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '添加失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h3 className={styles.title}>预分配玩家</h3>
        <p className={styles.subtitle}>
          添加玩家到指定座位，对方加入时用相同昵称即可自动入座
        </p>

        {/* Current seats */}
        <div style={{ marginBottom: 16, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
          已占座位: {takenSeats.length > 0 ? takenSeats.sort((a, b) => (a || 0) - (b || 0)).join(', ') : '无'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <input
            className={styles.input}
            style={{ marginBottom: 0, textAlign: 'left' }}
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="玩家昵称"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className={styles.input}
              style={{ marginBottom: 0, flex: 1 }}
              type="number"
              value={seat}
              onChange={e => setSeat(e.target.value)}
              placeholder="座位号"
              min={1}
              max={10}
            />
            <input
              className={styles.input}
              style={{ marginBottom: 0, flex: 1 }}
              type="number"
              value={chips}
              onChange={e => setChips(e.target.value)}
              placeholder="筹码 (默认)"
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>关闭</button>
          <button className={styles.confirmBtn} onClick={handleAdd} disabled={loading}>
            {loading ? '添加中...' : '添加玩家'}
          </button>
        </div>
      </div>
    </div>
  );
}
