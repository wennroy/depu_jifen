import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { Plus, Spade, LogIn, LogOut } from 'lucide-react';
import http from '../api/http';
import { useUser } from '../contexts/UserContext';
import styles from './HomePage.module.css';
import formStyles from '../components/home/Forms.module.css';

interface RoomSummary {
  room_id: string;
  room_code: string;
  room_name: string;
  seat: number | null;
  chips: number;
  status: string;
  game_phase: string;
  is_invited: boolean;
}

export default function HomePage() {
  const { user, logout } = useUser();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [initialChips, setInitialChips] = useState(1000);
  const [smallBlind, setSmallBlind] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);
  const [loading, setLoading] = useState(false);

  const headers = { 'X-User-Token': user?.userToken || '' };

  useEffect(() => {
    if (!user) return;
    http.get('/users/me/rooms', { headers }).then(({ data }) => setRooms(data.rooms)).catch(() => {});
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) { Toast.show({ content: '请输入房间名' }); return; }
    setLoading(true);
    try {
      const { data } = await http.post('/rooms', {
        name: roomName.trim(), admin_username: user!.username,
        initial_chips: initialChips, small_blind: smallBlind, big_blind: bigBlind,
      }, { headers });
      navigate(`/room/${data.room_code}`);
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '创建失败', icon: 'fail' });
    } finally { setLoading(false); }
  };

  const handleAccept = async (roomCode: string) => {
    try {
      await http.post(`/rooms/${roomCode}/accept-invite`, {}, { headers });
      navigate(`/room/${roomCode}`);
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '加入失败', icon: 'fail' });
    }
  };

  return (
    <div className="felt-bg" style={{ minHeight: '100dvh', padding: '20px 16px' }}>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Spade size={20} style={{ color: 'var(--color-accent)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-accent)' }}>
              {user?.username}
            </span>
          </div>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
            <LogOut size={14} /> 退出
          </button>
        </div>

        {/* My rooms */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'var(--font-display)', marginBottom: 10 }}>
            我的房间
          </div>
          {rooms.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              暂无房间，创建一个开始游戏吧
            </div>
          )}
          {rooms.map(r => (
            <div key={r.room_id} className="glass-card" style={{ padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => r.is_invited ? handleAccept(r.room_code) : navigate(`/room/${r.room_code}`)}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{r.room_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', marginTop: 2 }}>
                  #{r.room_code} · {r.game_phase === 'lobby' ? '等待中' : '游戏中'} · 座位 {r.seat}
                </div>
              </div>
              {r.is_invited ? (
                <button style={{ padding: '6px 14px', background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dim))', border: 'none', borderRadius: 8, color: 'var(--color-bg-deep)', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-display)', cursor: 'pointer' }}>
                  <LogIn size={12} style={{ marginRight: 4 }} /> 接受
                </button>
              ) : (
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-accent-bright)', fontFamily: 'var(--font-display)' }}>
                  {r.chips.toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Create room */}
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)}
            style={{ width: '100%', padding: 16, background: 'var(--color-glass-bg)', border: '1px dashed var(--color-accent-border)', borderRadius: 16, color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: 1 }}>
            <Plus size={18} /> 创建新房间
          </button>
        ) : (
          <div className="glass-card" style={{ padding: '24px 20px' }}>
            <form onSubmit={handleCreate} className={formStyles.form}>
              <div className={formStyles.field}>
                <label className={formStyles.label}>房间名称</label>
                <input className={formStyles.input} value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="例如：周五德扑局" maxLength={100} autoFocus />
              </div>
              <div className={formStyles.field}>
                <label className={formStyles.label}>初始筹码</label>
                <input className={formStyles.input} type="number" value={initialChips} onChange={e => setInitialChips(Math.max(100, parseInt(e.target.value) || 100))} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className={formStyles.field} style={{ flex: 1 }}>
                  <label className={formStyles.label}>小盲</label>
                  <input className={formStyles.input} type="number" value={smallBlind} onChange={e => setSmallBlind(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div className={formStyles.field} style={{ flex: 1 }}>
                  <label className={formStyles.label}>大盲</label>
                  <input className={formStyles.input} type="number" value={bigBlind} onChange={e => setBigBlind(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: 14, background: 'var(--color-glass-bg)', border: '1px solid var(--color-glass-border)', borderRadius: 12, color: 'var(--color-text-secondary)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-display)' }}>取消</button>
                <button className={formStyles.submitBtn} type="submit" disabled={loading} style={{ flex: 1, margin: 0 }}>{loading ? '创建中...' : '创建房间'}</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
