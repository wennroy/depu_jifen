import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import { useUser } from '../../contexts/UserContext';
import styles from './Forms.module.css';

interface Props {
  defaultCode?: string;
}

export default function JoinRoomForm({ defaultCode }: Props) {
  const [roomCode, setRoomCode] = useState(defaultCode || '');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      Toast.show({ content: '请填写房间号' });
      return;
    }
    if (!user?.userToken) {
      Toast.show({ content: '登录状态已失效，请重新进入', icon: 'fail' });
      return;
    }
    setLoading(true);
    try {
      await http.post(`/rooms/${code}/accept-invite`, {}, {
        headers: { 'X-User-Token': user.userToken },
      });
      Toast.show({ content: '加入房间成功！', icon: 'success' });
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
      <button className={styles.submitBtn} type="submit" disabled={loading}>
        {loading ? '加入中...' : '加入房间'}
      </button>
    </form>
  );
}
