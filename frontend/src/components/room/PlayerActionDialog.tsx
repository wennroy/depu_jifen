import { useState } from 'react';
import { Toast } from 'antd-mobile';
import { X, Hand, Ban, Coffee, Eye, ArrowRightLeft, Settings2 } from 'lucide-react';
import http from '../../api/http';
import { useUser } from '../../contexts/UserContext';
import type { Player, GamePhase } from '../../stores/gameStore';
import styles from './Modal.module.css';
import cardStyles from './PlayerAction.module.css';

interface Props {
  player: Player;
  roomCode: string;
  gamePhase: GamePhase;
  actionSeat: number | null;
  currentBetLevel: number;
  bigBlind: number;
  pot: number;
  onClose: () => void;
  onTransfer: () => void;
  onAdjust: () => void;
}

export default function PlayerActionDialog({
  player, roomCode, gamePhase, actionSeat, currentBetLevel, bigBlind, pot, onClose, onTransfer, onAdjust,
}: Props) {
  const { user } = useUser();
  const [raiseAmount, setRaiseAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const headers = { 'X-User-Token': user?.userToken || '' };

  const isTheirTurn = player.seat === actionSeat;
  const inGame = gamePhase !== 'lobby' && gamePhase !== 'showdown';
  const callAmount = Math.min(currentBetLevel - player.round_bet, player.chips);

  const doAction = async (action: string, amount: number = 0) => {
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/action`, {
        target_player_id: player.player_id, action, amount,
      }, { headers });
      onClose();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '操作失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  const handleRaise = () => {
    const val = parseInt(raiseAmount);
    if (!val || val <= currentBetLevel) {
      Toast.show({ content: `加注须大于 ${currentBetLevel}` });
      return;
    }
    if (val >= player.chips + player.round_bet) {
      doAction('allin');
    } else {
      doAction('raise', val);
    }
  };

  const handleSetStatus = async (sitout: boolean) => {
    try {
      await http.post(`/rooms/${roomCode}/set-status`, {
        player_id: player.player_id, away: sitout,
      }, { headers });
      Toast.show({ content: sitout ? '已设为暂离' : '已取消暂离', icon: 'success', duration: 1000 });
      onClose();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '操作失败', icon: 'fail' });
    }
  };

  const handleSetRole = async (role: string) => {
    try {
      await http.post(`/rooms/${roomCode}/set-role`, {
        player_id: player.player_id, role,
      }, { headers });
      Toast.show({ content: role === 'observer' ? '已设为观察者' : '已加入牌桌', icon: 'success', duration: 1000 });
      onClose();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '操作失败', icon: 'fail' });
    }
  };

  const suggestions = [
    { label: `${currentBetLevel + bigBlind}`, value: currentBetLevel + bigBlind },
    { label: `2x`, value: (currentBetLevel || bigBlind) * 2 },
    { label: `½Pot`, value: Math.floor(pot / 2) || bigBlind },
    { label: `Pot`, value: pot || bigBlind * 2 },
  ].filter(s => s.value > currentBetLevel && s.value <= player.chips + player.round_bet);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className={styles.header}>
          <span className={styles.title}>{player.username} #{player.seat}</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '0 20px 16px' }}>
          <div className={cardStyles.statusLine}>
            筹码: <strong style={{ color: 'var(--color-accent-bright)' }}>{player.chips.toLocaleString()}</strong>
            {' · '}
            {player.status === 'online' ? '在线' : player.status === 'afk' ? 'AFK' : '暂离'}
            {player.is_folded && ' · 已弃牌'}
          </div>

        {/* Game actions (only when it's their turn) */}
        {isTheirTurn && inGame && !player.is_folded && (
          <div className={cardStyles.section}>
            <div className={cardStyles.sectionTitle}>帮 {player.username} 操作</div>
            <div className={cardStyles.actionRow}>
              <button className={cardStyles.foldBtn} onClick={() => doAction('fold')} disabled={loading}>
                <Ban size={14} /> 弃牌
              </button>
              <button className={cardStyles.callBtn} onClick={() => doAction('call')} disabled={loading}>
                <Hand size={14} /> {callAmount > 0 ? `跟注 ${callAmount}` : '过牌'}
              </button>
            </div>

            {/* Suggestions */}
            <div className={cardStyles.suggestions}>
              {suggestions.map((s, i) => (
                <button key={i} className={cardStyles.suggestBtn} onClick={() => setRaiseAmount(String(s.value))}>{s.label}</button>
              ))}
              <button className={cardStyles.suggestBtn} onClick={() => doAction('allin')} disabled={loading}>All-in</button>
            </div>

            {/* Custom raise */}
            <div className={cardStyles.raiseRow}>
              <input
                className={cardStyles.input}
                type="number"
                value={raiseAmount}
                onChange={e => setRaiseAmount(e.target.value)}
                placeholder={`加注 (>${currentBetLevel})`}
              />
              <button className={cardStyles.raiseBtn} onClick={handleRaise} disabled={loading || !raiseAmount}>加注</button>
            </div>
          </div>
        )}

        {/* Management actions */}
        <div className={cardStyles.section}>
          <div className={cardStyles.sectionTitle}>管理</div>
          <div className={cardStyles.mgmtGrid}>
            {gamePhase === 'lobby' && (
              <>
                <button className={cardStyles.mgmtBtn} onClick={() => handleSetStatus(player.status !== 'sitout')}>
                  <Coffee size={14} />
                  {player.status === 'sitout' ? '取消暂离' : '设为暂离'}
                </button>
                {player.role === 'player' && (
                  <button className={cardStyles.mgmtBtn} onClick={() => handleSetRole('observer')}>
                    <Eye size={14} /> 设为观察者
                  </button>
                )}
              </>
            )}
            <button className={cardStyles.mgmtBtn} onClick={() => { onClose(); onTransfer(); }}>
              <ArrowRightLeft size={14} /> 转账
            </button>
            <button className={cardStyles.mgmtBtn} onClick={() => { onClose(); onAdjust(); }}>
              <Settings2 size={14} /> 调整筹码
            </button>
          </div>
        </div>

        </div>
      </div>
    </div>
  );
}
