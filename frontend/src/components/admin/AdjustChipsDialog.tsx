import { useState } from 'react';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import styles from '../room/Dialog.module.css';

interface Props {
  roomCode: string;
  adminToken: string;
  targetPlayerId: string;
  targetUsername: string;
  onClose: () => void;
}

export default function AdjustChipsDialog({ roomCode, adminToken, targetPlayerId, targetUsername, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdjust = async () => {
    const val = parseInt(amount);
    if (!val || val === 0) {
      Toast.show({ content: '请输入调整金额（正数增加，负数扣除）' });
      return;
    }
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/adjust`, {
        player_id: targetPlayerId,
        amount: val,
        note: note || undefined,
      }, { headers: { 'X-Admin-Token': adminToken } });
      Toast.show({ content: `已调整 ${targetUsername} 的筹码 ${val > 0 ? '+' : ''}${val}`, icon: 'success' });
      onClose();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '调整失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>调整 {targetUsername} 的筹码</h3>
        <p className={styles.subtitle}>正数增加筹码，负数扣除筹码</p>
        <input
          className={styles.input}
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="例如: 500 或 -200"
          autoFocus
        />
        <input
          className={styles.noteInput}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="备注（可选）"
        />
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button className={styles.confirmBtn} onClick={handleAdjust} disabled={loading}>
            {loading ? '调整中...' : '确认调整'}
          </button>
        </div>
      </div>
    </div>
  );
}
