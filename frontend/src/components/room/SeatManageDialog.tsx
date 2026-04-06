import { useState, useRef, useCallback } from 'react';
import { Toast } from 'antd-mobile';
import { GripVertical, X } from 'lucide-react';
import http from '../../api/http';
import type { Player } from '../../stores/gameStore';
import modalStyles from './Modal.module.css';
import styles from './SeatManage.module.css';

interface Props {
  roomCode: string;
  playerToken: string;
  players: Player[];
  onClose: () => void;
}

interface DragItem {
  pid: string;
  name: string;
  seat: number;
}

export default function SeatManageDialog({ roomCode, playerToken, players, onClose }: Props) {
  const activePlayers = players.filter(p => p.is_active && p.seat !== null && p.role === 'player')
    .sort((a, b) => (a.seat || 0) - (b.seat || 0));

  const [items, setItems] = useState<DragItem[]>(
    activePlayers.map(p => ({ pid: p.player_id, name: p.username, seat: p.seat! }))
  );
  const [dragging, setDragging] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Touch drag state
  const touchStartY = useRef(0);
  const dragIdx = useRef<number | null>(null);

  const reorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const newItems = [...items];
    const [moved] = newItems.splice(fromIdx, 1);
    newItems.splice(toIdx, 0, moved);
    // Reassign seat numbers sequentially
    setItems(newItems.map((item, i) => ({ ...item, seat: i + 1 })));
  };

  // Desktop drag
  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragging(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragging !== null && dragging !== idx) {
      reorder(dragging, idx);
      setDragging(idx);
    }
  };

  const handleDragEnd = () => setDragging(null);

  // Touch drag
  const handleTouchStart = (idx: number) => (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    dragIdx.current = idx;
    setDragging(idx);
  };

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragIdx.current === null || !listRef.current) return;
    const y = e.touches[0].clientY;
    const rows = listRef.current.querySelectorAll('[data-seat-row]');
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom && i !== dragIdx.current) {
        reorder(dragIdx.current, i);
        dragIdx.current = i;
        break;
      }
    }
  }, [items]);

  const handleTouchEnd = () => {
    dragIdx.current = null;
    setDragging(null);
  };

  const handleSave = async () => {
    const assignments = items.map(item => ({ player_id: item.pid, seat: item.seat }));
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/update-seats`, { assignments }, {
        headers: { 'X-User-Token': playerToken },
      });
      Toast.show({ content: '座位已更新', icon: 'success' });
      onClose();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '更新失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className={modalStyles.header}>
          <span className={modalStyles.title}>调整座位</span>
          <button className={modalStyles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={modalStyles.body}>
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
            拖拽调整座位顺序
          </p>
          <div ref={listRef} className={styles.list}>
            {items.map((item, idx) => (
              <div
                key={item.pid}
                data-seat-row
                className={`${styles.row} ${dragging === idx ? styles.dragging : ''}`}
                draggable
                onDragStart={handleDragStart(idx)}
                onDragOver={handleDragOver(idx)}
                onDragEnd={handleDragEnd}
                onTouchStart={handleTouchStart(idx)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <GripVertical size={16} className={styles.grip} />
                <span className={styles.seatNum}>{item.seat}</span>
                <span className={styles.name}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={modalStyles.footer}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              width: '100%', padding: 12,
              background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dim))',
              border: 'none', borderRadius: 'var(--radius-md)',
              color: 'var(--color-bg-deep)', fontWeight: 700,
              fontFamily: 'var(--font-display)', fontSize: '0.9rem',
              cursor: 'pointer', letterSpacing: '1px',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
