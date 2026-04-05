import { X, LogIn, Dice5, Coins, ArrowRightLeft, Wrench, Play, Ban, Hand, Trophy } from 'lucide-react';
import type { TransactionLog } from '../../stores/gameStore';
import styles from './LogDrawer.module.css';

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
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div className={`${styles.drawer} ${open ? styles.open : ''}`}>
        <div className={styles.header}>
          <span className={styles.title}>交易记录</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={styles.list}>
          {transactions.length === 0 && (
            <div className={styles.empty}>暂无记录</div>
          )}
          {transactions.map(tx => (
            <div key={tx.id} className={styles.item}>
              <span className={styles.icon}>{TX_ICONS[tx.tx_type] || <Coins size={13} />}</span>
              <div className={styles.info}>
                <span className={styles.desc}>{tx.note || tx.tx_type}</span>
                <span className={styles.time}>
                  {new Date(tx.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              {tx.amount > 0 && <span className={styles.amount}>{tx.amount}</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
