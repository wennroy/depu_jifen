import { Toast } from 'antd-mobile';
import http from '../../api/http';
import styles from './AdminToolbar.module.css';

interface Props {
  roomCode: string;
  adminToken: string;
  onSettle: () => void;
}

export default function AdminToolbar({ roomCode, adminToken, onSettle }: Props) {
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
      <div className={styles.label}>管理员</div>
      <div className={styles.buttons}>
        <button className={styles.btn} onClick={handleNextRound}>下一局</button>
        <button className={`${styles.btn} ${styles.settleBtn}`} onClick={onSettle}>结算</button>
      </div>
    </div>
  );
}
