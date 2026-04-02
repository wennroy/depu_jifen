import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import { useGameStore } from '../../stores/gameStore';
import styles from './Forms.module.css';

export default function CreateRoomForm() {
  const [roomName, setRoomName] = useState('');
  const [username, setUsername] = useState('');
  const [initialChips, setInitialChips] = useState(1000);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setIdentity = useGameStore(s => s.setIdentity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !username.trim()) {
      Toast.show({ content: '请填写房间名和昵称' });
      return;
    }
    setLoading(true);
    try {
      const { data } = await http.post('/rooms', {
        name: roomName.trim(),
        admin_username: username.trim(),
        initial_chips: initialChips,
      });
      setIdentity({
        roomCode: data.room_code,
        playerToken: data.player_token,
        playerId: data.player_id,
        username: username.trim(),
        adminToken: data.admin_token,
      });
      Toast.show({ content: '房间创建成功！', icon: 'success' });
      navigate(`/room/${data.room_code}`);
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '创建失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label}>房间名称</label>
        <input
          className={styles.input}
          value={roomName}
          onChange={e => setRoomName(e.target.value)}
          placeholder="例如：周五德扑局"
          maxLength={100}
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
      <div className={styles.field}>
        <label className={styles.label}>初始筹码</label>
        <input
          className={styles.input}
          type="number"
          value={initialChips}
          onChange={e => setInitialChips(Math.max(100, parseInt(e.target.value) || 100))}
          min={100}
          max={1000000}
        />
      </div>
      <button className={styles.submitBtn} type="submit" disabled={loading}>
        {loading ? '创建中...' : '创建房间'}
      </button>
    </form>
  );
}
