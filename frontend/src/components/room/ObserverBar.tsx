import { Eye, UserPlus } from 'lucide-react';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import type { Player, GamePhase } from '../../stores/gameStore';
import styles from './ObserverBar.module.css';

interface Props {
  observers: Player[];
  roomCode: string;
  userToken: string;
  gamePhase: GamePhase;
}

export default function ObserverBar({ observers, roomCode, userToken, gamePhase }: Props) {
  if (observers.length === 0) return null;

  const handleJoinTable = async (playerId: string) => {
    try {
      await http.post(`/rooms/${roomCode}/set-role`, {
        player_id: playerId, role: 'player',
      }, { headers: { 'X-User-Token': userToken } });
      Toast.show({ content: '已加入牌桌', icon: 'success', duration: 1000 });
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '操作失败', icon: 'fail' });
    }
  };

  return (
    <div className={styles.bar}>
      <Eye size={13} className={styles.icon} />
      <span className={styles.label}>观察者:</span>
      {observers.map(o => (
        <span key={o.player_id} className={styles.name}>
          {o.username}
          {gamePhase === 'lobby' && (
            <button className={styles.joinBtn} onClick={() => handleJoinTable(o.player_id)} title="加入牌桌">
              <UserPlus size={10} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
