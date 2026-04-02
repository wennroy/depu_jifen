import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import { useGameStore } from '../../stores/gameStore';
import styles from './Forms.module.css';

interface Props {
  defaultCode?: string;
}

export default function JoinRoomForm({ defaultCode }: Props) {
  const [roomCode, setRoomCode] = useState(defaultCode || '');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setIdentity = useGameStore(s => s.setIdentity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code || !username.trim()) {
      Toast.show({ content: '请填写房间号和昵称' });
      return;
    }
    setLoading(true);
    try {
      const { data } = await http.post(`/rooms/${code}/join`, {
        username: username.trim(),
      });
      setIdentity({
        roomCode: code,
        playerToken: data.player_token,
        playerId: data.player_id,
        username: username.trim(),
      });
      Toast.show({ content: `加入 ${data.room_name} 成功！`, icon: 'success' });
      navigate(`/room/${code}`);
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '加入失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label}>房间号</label>
        <input
          className={styles.input}
          value={roomCode}
          onChange={e => setRoomCode(e.target.value.toUpperCase())}
          placeholder="输入6位房间号"
          maxLength={6}
          style={{ letterSpacing: '4px', fontWeight: 700, textAlign: 'center' }}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>你的昵称</label>
        <input
          className={styles.input}
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="输入你的昵称"
          maxLength={50}
        />
      </div>
      <button className={styles.submitBtn} type="submit" disabled={loading}>
        {loading ? '加入中...' : '加入房间'}
      </button>
    </form>
  );
}
