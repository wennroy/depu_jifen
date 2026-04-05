import { useState } from 'react';
import { Toast } from 'antd-mobile';
import http from '../../api/http';
import styles from './Dialog.module.css';

interface Props {
  roomCode: string;
  playerToken: string;
  initialChips: number;
  onClose: () => void;
}

export default function RebuyDialog({ roomCode, playerToken, initialChips, onClose }: Props) {
  const [amount, setAmount] = useState(String(initialChips));
  const [loading, setLoading] = useState(false);

  const presets = [500, 1000, 2000, 5000];

  const handleRebuy = async () => {
    const val = parseInt(amount);
    if (!val || val <= 0) {
      Toast.show({ content: '请输入有效金额' });
      return;
    }
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/rebuy`, { amount: val }, {
        headers: { 'X-User-Token': playerToken },
      });
      Toast.show({ content: `买入 ${val} 筹码成功`, icon: 'success' });
      onClose();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '买入失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <h3 className={styles.title}>买入筹码</h3>
        <p className={styles.subtitle}>选择或输入买入金额</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {presets.map(v => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              style={{
                padding: '10px 0',
                background: parseInt(amount) === v ? 'var(--color-accent-glass)' : 'var(--color-glass-bg)',
                border: `1px solid ${parseInt(amount) === v ? 'var(--color-accent-border)' : 'var(--color-glass-border)'}`,
                borderRadius: 'var(--radius-sm)',
                color: parseInt(amount) === v ? 'var(--color-accent)' : 'var(--color-text-primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        <input
          className={styles.input}
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="自定义金额"
          autoFocus
          min={1}
        />
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>取消</button>
          <button className={styles.confirmBtn} onClick={handleRebuy} disabled={loading}>
            {loading ? '买入中...' : '确认买入'}
          </button>
        </div>
      </div>
    </div>
  );
}
