import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { Share2, Loader2 } from 'lucide-react';
import http from '../api/http';
import { useGameStore, getStoredTokens } from '../stores/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import PlayerList from '../components/room/PlayerList';
import BetPanel from '../components/room/BetPanel';
import TransferDialog from '../components/room/TransferDialog';
import RebuyDialog from '../components/room/RebuyDialog';
import GameLog from '../components/room/GameLog';
import AdminToolbar from '../components/admin/AdminToolbar';
import SettleRoundDialog from '../components/admin/SettleRoundDialog';
import AdjustChipsDialog from '../components/admin/AdjustChipsDialog';
import PreassignDialog from '../components/admin/PreassignDialog';
import DashboardDialog from '../components/admin/DashboardDialog';
import styles from './RoomPage.module.css';

function copyToClipboardFallback(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export default function RoomPage() {
  const { roomCode: urlRoomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const store = useGameStore();
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [showSettle, setShowSettle] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<string | null>(null);
  const [showPreassign, setShowPreassign] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showRebuy, setShowRebuy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const roomCode = urlRoomCode?.toUpperCase() || '';

  // Restore tokens from localStorage
  useEffect(() => {
    const tokens = getStoredTokens(roomCode);
    if (!tokens.playerToken) {
      navigate(`/join/${roomCode}`);
      return;
    }
    store.setIdentity({
      roomCode,
      playerToken: tokens.playerToken,
      playerId: tokens.playerId || '',
      username: tokens.username || '',
      adminToken: tokens.adminToken || undefined,
    });
  }, [roomCode]);

  // Fetch room state (pass admin token in header so backend can check)
  useEffect(() => {
    if (!store.playerToken || !roomCode) return;
    const fetchState = async () => {
      try {
        const headers: Record<string, string> = { 'X-Player-Token': store.playerToken! };
        if (store.adminToken) {
          headers['X-Admin-Token'] = store.adminToken;
        }
        const { data } = await http.get(`/rooms/${roomCode}/state`, { headers });
        store.setRoomState(data);
        setLoaded(true);
      } catch {
        Toast.show({ content: '获取房间信息失败', icon: 'fail' });
        navigate('/');
      }
    };
    fetchState();
  }, [store.playerToken, roomCode]);

  // WebSocket connection
  useWebSocket(roomCode, store.playerToken);

  const handleShare = async () => {
    const url = `${window.location.origin}/join/${roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: store.roomName, text: `来加入德扑局: ${store.roomName}`, url });
        return;
      }
    } catch {
      // share cancelled or not supported, fall through
    }
    // Clipboard fallback (works on HTTP too)
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      copyToClipboardFallback(url);
    }
    Toast.show({ content: '链接已复制', icon: 'success' });
  };

  if (!loaded) {
    return (
      <div className="felt-bg" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12, color: 'var(--color-accent)' }} />
          <div style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>加载中...</div>
        </div>
      </div>
    );
  }

  const myPlayer = store.players.find(p => p.player_id === store.playerId);

  return (
    <div className={`felt-bg ${styles.page}`}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.roomName}>{store.roomName}</h1>
          <div className={styles.roomMeta}>
            <span className={styles.roomCode}>#{roomCode}</span>
            <span className={styles.round}>R{store.currentRound}</span>
            <span className={styles.blinds}>盲注 {store.smallBlind}/{store.bigBlind}</span>
            <span className={`${styles.statusDot} ${store.wsConnected ? styles.online : styles.offline}`} />
          </div>
        </div>
        <button className={styles.shareBtn} onClick={handleShare}>
          <Share2 size={14} />
          分享
        </button>
      </header>

      {/* My chips */}
      {myPlayer && (
        <div className={styles.myChips}>
          <div>
            <span className={styles.myChipsLabel}>我的筹码</span>
            {myPlayer.seat && <span className={styles.mySeat}>座位 {myPlayer.seat}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className={styles.myChipsValue}>{myPlayer.chips.toLocaleString()}</span>
            <button className={styles.rebuyBtn} onClick={() => setShowRebuy(true)}>买入</button>
          </div>
        </div>
      )}

      {/* Player list */}
      <PlayerList
        players={store.players}
        myPlayerId={store.playerId || ''}
        isAdmin={store.isAdmin}
        onTransfer={setTransferTarget}
        onAdjust={store.isAdmin ? setAdjustTarget : undefined}
      />

      {/* Bet panel */}
      <BetPanel roomCode={roomCode} playerToken={store.playerToken || ''} currentChips={myPlayer?.chips || 0} />

      {/* Game log */}
      <GameLog transactions={store.transactions} />

      {/* Admin toolbar */}
      {store.isAdmin && (
        <AdminToolbar
          roomCode={roomCode}
          adminToken={store.adminToken || ''}
          onSettle={() => setShowSettle(true)}
          onPreassign={() => setShowPreassign(true)}
          onDashboard={() => setShowDashboard(true)}
        />
      )}

      {/* Dialogs */}
      {transferTarget && (
        <TransferDialog
          roomCode={roomCode}
          playerToken={store.playerToken || ''}
          targetPlayerId={transferTarget}
          targetUsername={store.players.find(p => p.player_id === transferTarget)?.username || ''}
          currentChips={myPlayer?.chips || 0}
          onClose={() => setTransferTarget(null)}
        />
      )}

      {showRebuy && (
        <RebuyDialog
          roomCode={roomCode}
          playerToken={store.playerToken || ''}
          initialChips={store.smallBlind * 200}
          onClose={() => setShowRebuy(false)}
        />
      )}

      {showSettle && (
        <SettleRoundDialog
          roomCode={roomCode}
          adminToken={store.adminToken || ''}
          players={store.players.filter(p => p.is_active)}
          currentRound={store.currentRound}
          onClose={() => setShowSettle(false)}
        />
      )}

      {adjustTarget && (
        <AdjustChipsDialog
          roomCode={roomCode}
          adminToken={store.adminToken || ''}
          targetPlayerId={adjustTarget}
          targetUsername={store.players.find(p => p.player_id === adjustTarget)?.username || ''}
          onClose={() => setAdjustTarget(null)}
        />
      )}

      {showPreassign && (
        <PreassignDialog
          roomCode={roomCode}
          adminToken={store.adminToken || ''}
          existingPlayers={store.players}
          onClose={() => setShowPreassign(false)}
        />
      )}

      {showDashboard && (
        <DashboardDialog
          roomCode={roomCode}
          adminToken={store.adminToken || ''}
          onClose={() => setShowDashboard(false)}
        />
      )}
    </div>
  );
}
