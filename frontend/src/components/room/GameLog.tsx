import type { TransactionLog } from '../../stores/gameStore';
import styles from './GameLog.module.css';

interface Props {
  transactions: TransactionLog[];
}

const TX_ICONS: Record<string, string> = {
  join: '📥',
  bet: '🎲',
  settle: '💰',
  transfer: '💸',
  adjust: '🔧',
};

const TX_LABELS: Record<string, string> = {
  join: '加入',
  bet: '下注',
  settle: '结算',
  transfer: '转账',
  adjust: '调整',
};

export default function GameLog({ transactions }: Props) {
  if (transactions.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.sectionTitle}>交易记录</div>
      <div className={styles.list}>
        {transactions.slice(0, 20).map(tx => (
          <div key={tx.id} className={styles.item}>
            <span className={styles.icon}>{TX_ICONS[tx.tx_type] || '📝'}</span>
            <div className={styles.info}>
              <span className={styles.desc}>
                {tx.note || `${TX_LABELS[tx.tx_type] || tx.tx_type} ${tx.amount}`}
              </span>
              <span className={styles.time}>
                {new Date(tx.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <span className={styles.amount}>
              {tx.tx_type === 'settle' || tx.tx_type === 'transfer'
                ? `${tx.amount}`
                : tx.to_username ? `+${tx.amount}` : `-${tx.amount}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
