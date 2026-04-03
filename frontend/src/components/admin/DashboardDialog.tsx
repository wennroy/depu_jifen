import { useEffect, useState } from 'react';
import { Toast } from 'antd-mobile';
import { CupSoda, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import http from '../../api/http';
import styles from './Dashboard.module.css';

interface BuyinRecord {
  player_id: string;
  username: string;
  seat: number | null;
  current_chips: number;
  initial_buyin: number;
  rebuy_count: number;
  rebuy_total: number;
  total_invested: number;
  is_active: boolean;
}

interface Props {
  roomCode: string;
  adminToken: string;
  onClose: () => void;
}

export default function DashboardDialog({ roomCode, adminToken, onClose }: Props) {
  const [records, setRecords] = useState<BuyinRecord[]>([]);
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await http.get(`/rooms/${roomCode}/dashboard`, {
          headers: { 'X-Admin-Token': adminToken },
        });
        setRecords(data.players);
        setRoomName(data.room_name);
      } catch (err: any) {
        Toast.show({ content: '获取账单失败', icon: 'fail' });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const totalRebuys = records.reduce((sum, r) => sum + r.rebuy_total, 0);
  const totalRebuyCount = records.reduce((sum, r) => sum + r.rebuy_count, 0);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <CupSoda size={24} className={styles.teaIcon} />
            <h3 className={styles.title}>奶茶账单</h3>
            <CupSoda size={24} className={styles.teaIcon} />
          </div>
          <p className={styles.subtitle}>{roomName} - 买入记录</p>
        </div>

        {/* Summary */}
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>总买入次数</span>
            <span className={styles.summaryValue}>{totalRebuyCount}</span>
          </div>
          <div className={styles.summaryDivider} />
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>总买入金额</span>
            <span className={styles.summaryValue}>{totalRebuys.toLocaleString()}</span>
          </div>
        </div>

        {/* Player records */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)' }}>加载中...</div>
        ) : (
          <div className={styles.list}>
            {records.map(r => {
              const profit = r.current_chips - r.total_invested;
              return (
                <div key={r.player_id} className={styles.row}>
                  <div className={styles.rowLeft}>
                    <div className={styles.rowName}>
                      {r.seat && <span className={styles.seat}>#{r.seat}</span>}
                      {r.username}
                      {!r.is_active && <span className={styles.inactive}>离开</span>}
                    </div>
                    <div className={styles.rowDetail}>
                      初始 {r.initial_buyin}
                      {r.rebuy_count > 0 && (
                        <>
                          {' '}· 买入 {r.rebuy_count}次
                          <CupSoda size={12} style={{ marginLeft: 4, color: 'var(--color-warning)' }} />
                          {' '}{r.rebuy_total}
                        </>
                      )}
                    </div>
                  </div>
                  <div className={styles.rowRight}>
                    <div className={styles.rowChips}>{r.current_chips.toLocaleString()}</div>
                    <div className={`${styles.rowProfit} ${profit > 0 ? styles.profitUp : profit < 0 ? styles.profitDown : ''}`}>
                      {profit > 0 ? <TrendingUp size={12} /> : profit < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      <span>{profit > 0 ? '+' : ''}{profit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.footer}>
          <span className={styles.footerHint}>输了请大家喝奶茶吧~</span>
          <button className={styles.closeBtn} onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
