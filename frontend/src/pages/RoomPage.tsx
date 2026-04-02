import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import http from '../api/http';
import { useGameStore, getStoredTokens } from '../stores/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import PlayerList from '../components/room/PlayerList';
import BetPanel from '../components/room/BetPanel';
import TransferDialog from '../components/room/TransferDialog';
import GameLog from '../components/room/GameLog';
import AdminToolbar from '../components/admin/AdminToolbar';
import SettleRoundDialog from '../components/admin/SettleRoundDialog';
import AdjustChipsDialog from '../components/admin/AdjustChipsDialog';
import styles from './RoomPage.module.css';

export default function RoomPage() {
  const { roomCode: urlRoomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const store = useGameStore();
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [showSettle, setShowSettle] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<string | null>(null);
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

  // Fetch room state
  useEffect(() => {
    if (!store.playerToken || !roomCode) return;
    const fetchState = async () => {
      try {
        const { data } = await http.get(`/rooms/${roomCode}/state`, {
          headers: { 'X-Player-Token': store.playerToken },
        });
        store.setRoomState(data);
        setLoaded(true);
      } catch {
        Toast.show({ content: '获取房间信息失败', icon: 'fail' });
        navigate('/');
      }
    };
    fetchState();
  }, [store.playerToken, roomCode]);

  // Check admin status
  useEffect(() => {
    if (!store.adminToken || !roomCode) return;
    const checkAdmin = async () => {
      try {
        const { data } = await http.post(`/rooms/${roomCode}/check-admin`, {}, {
          headers: { 'X-Admin-Token': store.adminToken },
        });
        store.setIsAdmin(data.is_admin);
      } catch {
        store.setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [store.adminToken, roomCode]);

  // WebSocket connection
  useWebSocket(roomCode, store.playerToken);

  const handleShare = async () => {
    const url = `${window.location.origin}/join/${roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: store.roomName, text: `来加入德扑局: ${store.roomName}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        Toast.show({ content: '链接已复制', icon: 'success' });
      }
    } catch {
      await navigator.clipboard.writeText(url);
      Toast.show({ content: '链接已复制', icon: 'success' });
    }
  };

  if (!loaded) {
    return (
      <div className="felt-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>♠ ♥ ♦ ♣</div>
          <div>加载中...</div>
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
            <span className={styles.round}>第 {store.currentRound} 局</span>
            <span className={`${styles.statusDot} ${store.wsConnected ? styles.online : styles.offline}`} />
          </div>
        </div>
        <button className={styles.shareBtn} onClick={handleShare}>
          分享
        </button>
      </header>

      {/* My chips */}
      {myPlayer && (
        <div className={styles.myChips}>
          <span className={styles.myChipsLabel}>我的筹码</span>
          <span className={styles.myChipsValue}>{myPlayer.chips.toLocaleString()}</span>
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
    </div>
  );
}
