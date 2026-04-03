import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { Share2, Loader2, UserPlus, CupSoda } from 'lucide-react';
import http from '../api/http';
import { useGameStore, getStoredTokens } from '../stores/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import PotDisplay from '../components/room/PotDisplay';
import PlayerCard from '../components/room/PlayerCard';
import GameControlButton from '../components/room/GameControlButton';
import BetActionPanel from '../components/room/BetActionPanel';
import SettlePanel from '../components/room/SettlePanel';
import GameLog from '../components/room/GameLog';
import TransferDialog from '../components/room/TransferDialog';
import RebuyDialog from '../components/room/RebuyDialog';
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
  const [showRebuy, setShowRebuy] = useState(false);
  const [showPreassign, setShowPreassign] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const roomCode = urlRoomCode?.toUpperCase() || '';

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
    });
  }, [roomCode]);

  useEffect(() => {
    if (!store.playerToken || !roomCode) return;
    const fetchState = async () => {
      try {
        const { data } = await http.get(`/rooms/${roomCode}/state`, {
          headers: { 'X-Player-Token': store.playerToken! },
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

  useWebSocket(roomCode, store.playerToken);

  const handleShare = async () => {
    const url = `${window.location.origin}/join/${roomCode}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: store.roomName, text: `来加入德扑局: ${store.roomName}`, url });
        return;
      }
    } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); } catch { copyToClipboardFallback(url); }
    Toast.show({ content: '链接已复制', icon: 'success' });
  };

  if (!loaded) {
    return (
      <div className="felt-bg" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-accent)' }} />
      </div>
    );
  }

  const myPlayer = store.players.find(p => p.player_id === store.playerId);
  const gameActive = store.gamePhase !== 'lobby';
  const seated = store.players
    .filter(p => p.seat !== null && (p.is_active || p.is_preassigned))
    .sort((a, b) => (a.seat || 0) - (b.seat || 0));

  // Determine SB/BB seats
  const dealerSeat = store.dealerSeat;
  const seatList = seated.filter(p => p.is_active).map(p => p.seat!);
  let sbSeat: number | null = null;
  let bbSeat: number | null = null;
  if (dealerSeat && seatList.length >= 2) {
    const dIdx = seatList.indexOf(dealerSeat);
    if (dIdx !== -1) {
      if (seatList.length === 2) {
        sbSeat = seatList[dIdx];
        bbSeat = seatList[(dIdx + 1) % seatList.length];
      } else {
        sbSeat = seatList[(dIdx + 1) % seatList.length];
        bbSeat = seatList[(dIdx + 2) % seatList.length];
      }
    }
  }

  return (
    <div className={`felt-bg ${styles.page}`}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.roomName}>{store.roomName}</h1>
          <span className={styles.roomCode}>#{roomCode}</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.iconBtn} onClick={() => setShowPreassign(true)} title="添加玩家">
            <UserPlus size={16} />
          </button>
          <button className={styles.iconBtn} onClick={() => setShowDashboard(true)} title="账单">
            <CupSoda size={16} />
          </button>
          <button className={styles.shareBtn} onClick={handleShare}>
            <Share2 size={14} />
          </button>
          <span className={`${styles.statusDot} ${store.wsConnected ? styles.online : styles.offline}`} />
        </div>
      </header>

      {/* Pot & Phase display */}
      <PotDisplay
        pot={store.pot}
        phase={store.gamePhase}
        currentBetLevel={store.currentBetLevel}
        round={store.currentRound}
        smallBlind={store.smallBlind}
        bigBlind={store.bigBlind}
      />

      {/* Player cards grid */}
      <div className={styles.playerGrid}>
        {seated.map(p => (
          <PlayerCard
            key={p.player_id}
            player={p}
            isMe={p.player_id === store.playerId}
            isDealer={p.seat === dealerSeat}
            isSB={p.seat === sbSeat}
            isBB={p.seat === bbSeat}
            isAction={p.seat === store.actionSeat}
            gameActive={gameActive}
            onActFor={(pid) => {
              if (gameActive && p.seat === store.actionSeat) {
                store.setActingFor(pid);
              } else if (!gameActive) {
                setTransferTarget(pid);
              }
            }}
          />
        ))}
      </div>

      {/* My chips bar */}
      {myPlayer && (
        <div className={styles.myBar}>
          <span>我的筹码: <strong>{myPlayer.chips.toLocaleString()}</strong></span>
          <button className={styles.rebuyBtn} onClick={() => setShowRebuy(true)}>买入</button>
        </div>
      )}

      {/* Game control / Action panels */}
      <GameControlButton
        roomCode={roomCode}
        playerToken={store.playerToken || ''}
        phase={store.gamePhase}
        bettingComplete={store.bettingComplete}
      />

      {gameActive && store.gamePhase !== 'showdown' && store.actionSeat && !store.bettingComplete && (
        <BetActionPanel />
      )}

      {store.gamePhase === 'showdown' && (
        <SettlePanel
          roomCode={roomCode}
          playerToken={store.playerToken || ''}
          pot={store.pot}
          players={store.players}
          onSettled={() => {}}
        />
      )}

      {/* Game log */}
      <GameLog transactions={store.transactions} />

      {/* Dialogs */}
      {transferTarget && myPlayer && (
        <TransferDialog
          roomCode={roomCode}
          playerToken={store.playerToken || ''}
          targetPlayerId={transferTarget}
          targetUsername={store.players.find(p => p.player_id === transferTarget)?.username || ''}
          currentChips={myPlayer.chips}
          onClose={() => setTransferTarget(null)}
        />
      )}
      {showRebuy && (
        <RebuyDialog
          roomCode={roomCode}
          playerToken={store.playerToken || ''}
          initialChips={store.bigBlind * 100}
          onClose={() => setShowRebuy(false)}
        />
      )}
      {showPreassign && (
        <PreassignDialog
          roomCode={roomCode}
          adminToken={store.playerToken || ''}
          existingPlayers={store.players}
          onClose={() => setShowPreassign(false)}
        />
      )}
      {showDashboard && (
        <DashboardDialog
          roomCode={roomCode}
          adminToken={store.playerToken || ''}
          onClose={() => setShowDashboard(false)}
        />
      )}
    </div>
  );
}
