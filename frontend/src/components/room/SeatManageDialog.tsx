import { useState } from 'react';
import { Toast } from 'antd-mobile';
import { ArrowUpDown } from 'lucide-react';
import http from '../../api/http';
import type { Player } from '../../stores/gameStore';
import styles from './Dialog.module.css';
import seatStyles from './SeatManage.module.css';

interface Props {
  roomCode: string;
  playerToken: string;
  players: Player[];
  onClose: () => void;
}

export default function SeatManageDialog({ roomCode, playerToken, players, onClose }: Props) {
  const activePlayers = players.filter(p => p.is_active && p.seat !== null).sort((a, b) => (a.seat || 0) - (b.seat || 0));
  const [seats, setSeats] = useState<Record<string, number>>(
    Object.fromEntries(activePlayers.map(p => [p.player_id, p.seat!]))
  );
  const [loading, setLoading] = useState(false);

  const moveSeat = (playerId: string, delta: number) => {
    const current = seats[playerId];
    const newSeat = current + delta;
    if (newSeat < 1 || newSeat > 10) return;

    // If someone is already at that seat, swap
    const occupant = Object.entries(seats).find(([id, s]) => s === newSeat && id !== playerId);
    if (occupant) {
      setSeats({ ...seats, [playerId]: newSeat, [occupant[0]]: current });
    } else {
      setSeats({ ...seats, [playerId]: newSeat });
    }
  };

  const handleSave = async () => {
    const assignments = Object.entries(seats).map(([player_id, seat]) => ({ player_id, seat }));

    // Check for duplicates
    const seatValues = assignments.map(a => a.seat);
    if (new Set(seatValues).size !== seatValues.length) {
      Toast.show({ content: '座位号不能重复' });
      return;
    }

    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/update-seats`, { assignments }, {
        headers: { 'X-User-Token': playerToken },
      });
      Toast.show({ content: '座位已更新', icon: 'success' });
      onClose();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '更新失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  const sorted = Object.entries(seats)
    .map(([pid, seat]) => ({ pid, seat, name: activePlayers.find(p => p.player_id === pid)?.username || '?' }))
    .sort((a, b) => a.seat - b.seat);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <h3 className={styles.title}>调整座位</h3>
        <p className={styles.subtitle}>点击箭头交换座位顺序</p>

        <div className={seatStyles.list}>
          {sorted.map(({ pid, seat, name }) => (
            <div key={pid} className={seatStyles.row}>
              <span className={seatStyles.seatNum}>{seat}</span>
              <span className={seatStyles.name}>{name}</span>
              <div className={seatStyles.arrows}>
                <button className={seatStyles.arrowBtn} onClick={() => moveSeat(pid, -1)}>
                  <ArrowUpDown size={14} />
                  <span style={{ fontSize: '0.6rem' }}>-</span>
                </button>
                <button className={seatStyles.arrowBtn} onClick={() => moveSeat(pid, 1)}>
                  <ArrowUpDown size={14} />
                  <span style={{ fontSize: '0.6rem' }}>+</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button className={styles.confirmBtn} onClick={handleSave} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
