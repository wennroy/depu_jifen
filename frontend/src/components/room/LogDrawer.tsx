import { X, LogIn, Dice5, Coins, ArrowRightLeft, Wrench, Play, Ban, Hand, Trophy } from 'lucide-react';
import type { TransactionLog } from '../../stores/gameStore';
import styles from './Modal.module.css';
import logStyles from './LogModal.module.css';

const TX_ICONS: Record<string, React.ReactNode> = {
  join: <LogIn size={13} />, bet: <Dice5 size={13} />, settle: <Trophy size={13} />,
  transfer: <ArrowRightLeft size={13} />, adjust: <Wrench size={13} />, rebuy: <Coins size={13} />,
  hand: <Play size={13} />, call: <Hand size={13} />, fold: <Ban size={13} />,
  raise: <Coins size={13} />, allin: <Coins size={13} />, blind: <Coins size={13} />,
  chips: <Coins size={13} />, win: <Trophy size={13} />,
};

interface Props {
  open: boolean;
  onClose: () => void;
  transactions: TransactionLog[];
}

export default function LogDrawer({ open, onClose, transactions }: Props) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>交易记录</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={logStyles.list}>
          {transactions.length === 0 && (
            <div className={logStyles.empty}>暂无记录</div>
          )}
          {transactions.map(tx => (
            <div key={tx.id} className={logStyles.item}>
              <span className={logStyles.icon}>{TX_ICONS[tx.tx_type] || <Coins size={13} />}</span>
              <div className={logStyles.info}>
                <span className={logStyles.desc}>{tx.note || tx.tx_type}</span>
                <span className={logStyles.time}>
                  {new Date(tx.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              {tx.amount > 0 && <span className={logStyles.amount}>{tx.amount}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
