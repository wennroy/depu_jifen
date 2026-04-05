import { useState } from 'react';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import styles from './Dialog.module.css';

interface Props {
  roomCode: string;
  playerToken: string;
  targetPlayerId: string;
  targetUsername: string;
  currentChips: number;
  onClose: () => void;
}

export default function TransferDialog({ roomCode, playerToken, targetPlayerId, targetUsername, currentChips, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    const val = parseInt(amount);
    if (!val || val <= 0) {
      Toast.show({ content: '请输入有效金额' });
      return;
    }
    if (val > currentChips) {
      Toast.show({ content: '筹码不足' });
      return;
    }
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/transfer`, {
        to_player_id: targetPlayerId,
        amount: val,
      }, { headers: { 'X-User-Token': playerToken } });
      Toast.show({ content: `已转给 ${targetUsername} ${val} 筹码`, icon: 'success' });
      onClose();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '转账失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>转账给 {targetUsername}</h3>
        <p className={styles.subtitle}>当前筹码: {currentChips.toLocaleString()}</p>
        <input
          className={styles.input}
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="转账金额"
          autoFocus
          min={1}
          max={currentChips}
        />
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button className={styles.confirmBtn} onClick={handleTransfer} disabled={loading}>
            {loading ? '转账中...' : '确认转账'}
          </button>
        </div>
      </div>
    </div>
  );
}
