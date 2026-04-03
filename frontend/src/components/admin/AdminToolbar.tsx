import { Toast } from 'antd-mobile';
import { SkipForward, Calculator, UserPlus, LayoutDashboard, Shield } from 'lucide-react';
import http from '../../api/http';
import styles from './AdminToolbar.module.css';

interface Props {
  roomCode: string;
  adminToken: string;
  onSettle: () => void;
  onPreassign: () => void;
  onDashboard: () => void;
}

export default function AdminToolbar({ roomCode, adminToken, onSettle, onPreassign, onDashboard }: Props) {
  const handleNextRound = async () => {
    try {
      const { data } = await http.post(`/rooms/${roomCode}/rounds/next`, {}, {
        headers: { 'X-Admin-Token': adminToken },
      });
      Toast.show({ content: `进入第 ${data.round} 局`, icon: 'success', duration: 1500 });
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '操作失败', icon: 'fail' });
    }
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.label}>
        <Shield size={12} />
        <span>管理</span>
      </div>
      <div className={styles.buttons}>
        <button className={styles.btn} onClick={handleNextRound}>
          <SkipForward size={14} />
          <span>下一局</span>
        </button>
        <button className={`${styles.btn} ${styles.settleBtn}`} onClick={onSettle}>
          <Calculator size={14} />
          <span>结算</span>
        </button>
        <button className={styles.btn} onClick={onPreassign}>
          <UserPlus size={14} />
          <span>添加</span>
        </button>
        <button className={styles.btn} onClick={onDashboard}>
          <LayoutDashboard size={14} />
          <span>账单</span>
        </button>
      </div>
    </div>
  );
}
