import { useState } from 'react';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import styles from './BetPanel.module.css';

interface Props {
  roomCode: string;
  playerToken: string;
  currentChips: number;
}

export default function BetPanel({ roomCode, playerToken, currentChips }: Props) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const presets = [10, 25, 50, 100];

  const handleBet = async (betAmount?: number) => {
    const val = betAmount || parseInt(amount);
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
      await http.post(`/rooms/${roomCode}/bet`, { amount: val }, {
        headers: { 'X-User-Token': playerToken },
      });
      setAmount('');
      Toast.show({ content: `下注 ${val}`, icon: 'success', duration: 1000 });
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '下注失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>下注</div>
      <div className={styles.presets}>
        {presets.map(v => (
          <button
            key={v}
            className={styles.presetBtn}
            onClick={() => handleBet(v)}
            disabled={loading || v > currentChips}
          >
            {v}
          </button>
        ))}
      </div>
      <div className={styles.customRow}>
        <input
          className={styles.input}
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="自定义金额"
          min={1}
          max={currentChips}
        />
        <button
          className={styles.betBtn}
          onClick={() => handleBet()}
          disabled={loading || !amount}
        >
          {loading ? '...' : '下注'}
        </button>
      </div>
    </div>
  );
}
