import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { Share2, Loader2, UserPlus, CupSoda, Armchair, ScrollText } from 'lucide-react';
import http from '../api/http';
import { useUser } from '../contexts/UserContext';
import { useGameStore } from '../stores/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import PotDisplay from '../components/room/PotDisplay';
import TableLayout from '../components/room/TableLayout';
import GameControlButton from '../components/room/GameControlButton';
import BetActionPanel from '../components/room/BetActionPanel';
import SettlePanel from '../components/room/SettlePanel';
import LogDrawer from '../components/room/LogDrawer';
import PlayerActionDialog from '../components/room/PlayerActionDialog';
import TransferDialog from '../components/room/TransferDialog';
import RebuyDialog from '../components/room/RebuyDialog';
import AdjustChipsDialog from '../components/admin/AdjustChipsDialog';
import PreassignDialog from '../components/admin/PreassignDialog';
import DashboardDialog from '../components/admin/DashboardDialog';
import SeatManageDialog from '../components/room/SeatManageDialog';
import ObserverBar from '../components/room/ObserverBar';
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
  const { user } = useUser();
  const store = useGameStore();
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<string | null>(null);
  const [showRebuy, setShowRebuy] = useState(false);
  const [showPreassign, setShowPreassign] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSeats, setShowSeats] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const roomCode = urlRoomCode?.toUpperCase() || '';
  const userToken = user?.userToken || '';
  const headers = { 'X-User-Token': userToken };

  // Fetch room state
  useEffect(() => {
    if (!userToken || !roomCode) return;
    http.get(`/rooms/${roomCode}/state`, { headers })
      .then(({ data }) => { store.setRoomState(data); setLoaded(true); })
      .catch(() => { Toast.show({ content: '获取房间信息失败', icon: 'fail' }); navigate('/'); });
  }, [userToken, roomCode]);

  // WebSocket with reconnect state refresh
  const handleReconnect = useCallback(() => {
    if (!userToken || !roomCode) return;
    http.get(`/rooms/${roomCode}/state`, { headers: { 'X-User-Token': userToken } })
      .then(({ data }) => store.setRoomState(data))
      .catch(() => {});
  }, [userToken, roomCode]);
  useWebSocket(roomCode, userToken, handleReconnect);

  const handleShare = async () => {
    const url = `${window.location.origin}/room/${roomCode}`;
    try { if (navigator.share) { await navigator.share({ title: store.roomName, url }); return; } } catch {}
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
  const isMyTurn = myPlayer && myPlayer.seat === store.actionSeat;
  const seated = store.players
    .filter(p => p.seat !== null && p.is_active && p.role === 'player')
    .sort((a, b) => (a.seat || 0) - (b.seat || 0));
  const observers = store.players.filter(p => p.is_active && p.role === 'observer');

  // SB/BB calculation
  const seatList = seated.map(p => p.seat!);
  let sbSeat: number | null = null, bbSeat: number | null = null;
  if (store.dealerSeat && seatList.length >= 2) {
    const dIdx = seatList.indexOf(store.dealerSeat);
    if (dIdx !== -1) {
      if (seatList.length === 2) { sbSeat = seatList[dIdx]; bbSeat = seatList[(dIdx + 1) % seatList.length]; }
      else { sbSeat = seatList[(dIdx + 1) % seatList.length]; bbSeat = seatList[(dIdx + 2) % seatList.length]; }
    }
  }

  const handlePlayerClick = (playerId: string) => {
    const p = store.players.find(x => x.player_id === playerId);
    if (!p) return;
    // If it's my turn and I click myself → just use bottom panel
    if (isMyTurn && playerId === store.playerId) return;
    // Otherwise open action dialog
    setActionTarget(playerId);
  };

  const actionPlayer = actionTarget ? store.players.find(p => p.player_id === actionTarget) : null;

  return (
    <div className={`felt-bg ${styles.page}`}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.roomName}>{store.roomName}</h1>
          <span className={styles.roomCode}>#{roomCode}</span>
        </div>
        <div className={styles.headerRight}>
          {store.gamePhase === 'lobby' && store.isCreator && (
            <>
              <button className={styles.iconBtn} onClick={() => setShowPreassign(true)} title="邀请玩家"><UserPlus size={16} /></button>
              <button className={styles.iconBtn} onClick={() => setShowSeats(true)} title="调整座位"><Armchair size={16} /></button>
            </>
          )}
          <button className={styles.iconBtn} onClick={() => setShowDashboard(true)} title="账单"><CupSoda size={16} /></button>
          <button className={styles.iconBtn} onClick={() => setShowLog(true)} title="记录"><ScrollText size={16} /></button>
          <button className={styles.shareBtn} onClick={handleShare}><Share2 size={14} /></button>
          <span className={`${styles.statusDot} ${store.wsConnected ? styles.online : styles.offline}`} />
        </div>
      </header>

      {/* Pot */}
      <PotDisplay pot={store.pot} phase={store.gamePhase} currentBetLevel={store.currentBetLevel}
        round={store.currentRound} smallBlind={store.smallBlind} bigBlind={store.bigBlind} />

      {/* Player table */}
      <TableLayout
        players={seated}
        myPlayerId={store.playerId}
        dealerSeat={store.dealerSeat}
        sbSeat={sbSeat}
        bbSeat={bbSeat}
        actionSeat={store.actionSeat}
        gameActive={gameActive}
        onPlayerClick={handlePlayerClick}
      />

      {/* Observers */}
      <ObserverBar observers={observers} roomCode={roomCode} userToken={userToken} gamePhase={store.gamePhase} />

      {/* My bar */}
      {myPlayer && (
        <div className={styles.myBar}>
          <span>我的筹码: <strong>{myPlayer.chips.toLocaleString()}</strong></span>
          <button className={styles.rebuyBtn} onClick={() => setShowRebuy(true)}>买入</button>
        </div>
      )}

      {/* Game controls (only visible to room creator) */}
      {store.isCreator && (
        <GameControlButton roomCode={roomCode} playerToken={userToken} phase={store.gamePhase} bettingComplete={store.bettingComplete} />
      )}

      {/* BetActionPanel: only when it's MY turn */}
      {isMyTurn && gameActive && store.gamePhase !== 'showdown' && !store.bettingComplete && (
        <BetActionPanel />
      )}

      {/* Settle (only visible to room creator) */}
      {store.gamePhase === 'showdown' && store.isCreator && (
        <SettlePanel roomCode={roomCode} playerToken={userToken} pot={store.pot}
          players={store.players} onSettled={() => {}} />
      )}

      {/* Log drawer */}
      <LogDrawer open={showLog} onClose={() => setShowLog(false)} transactions={store.transactions} />

      {/* Dialogs */}
      {actionPlayer && (
        <PlayerActionDialog
          player={actionPlayer} roomCode={roomCode} gamePhase={store.gamePhase}
          actionSeat={store.actionSeat} currentBetLevel={store.currentBetLevel}
          bigBlind={store.bigBlind} pot={store.pot}
          onClose={() => setActionTarget(null)}
          onTransfer={() => setTransferTarget(actionPlayer.player_id)}
          onAdjust={() => setAdjustTarget(actionPlayer.player_id)}
        />
      )}
      {transferTarget && myPlayer && (
        <TransferDialog roomCode={roomCode} playerToken={userToken}
          targetPlayerId={transferTarget}
          targetUsername={store.players.find(p => p.player_id === transferTarget)?.username || ''}
          currentChips={myPlayer.chips} onClose={() => setTransferTarget(null)} />
      )}
      {adjustTarget && (
        <AdjustChipsDialog roomCode={roomCode} adminToken={userToken}
          targetPlayerId={adjustTarget}
          targetUsername={store.players.find(p => p.player_id === adjustTarget)?.username || ''}
          onClose={() => setAdjustTarget(null)} />
      )}
      {showRebuy && (
        <RebuyDialog roomCode={roomCode} playerToken={userToken}
          initialChips={store.bigBlind * 100} onClose={() => setShowRebuy(false)} />
      )}
      {showPreassign && (
        <PreassignDialog roomCode={roomCode} adminToken={userToken}
          existingPlayers={store.players} onClose={() => setShowPreassign(false)} />
      )}
      {showSeats && (
        <SeatManageDialog roomCode={roomCode} playerToken={userToken}
          players={store.players} onClose={() => setShowSeats(false)} />
      )}
      {showDashboard && (
        <DashboardDialog roomCode={roomCode} adminToken={userToken}
          onClose={() => setShowDashboard(false)} />
      )}
    </div>
  );
}
