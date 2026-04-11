import { Crown, Coffee, LogOut, Hand } from 'lucide-react';
import type { Player } from '../../stores/gameStore';
import styles from './PlayerCard.module.css';

interface Props {
  player: Player;
  isMe: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isAction: boolean;
  gameActive: boolean;
  onActFor: (playerId: string) => void;
}

export default function PlayerCard({ player, isMe, isDealer, isSB, isBB, isAction, gameActive, onActFor }: Props) {
  const isAllIn = gameActive && !player.is_folded && player.chips === 0 && player.hand_bet > 0;

  return (
    <div
      className={`${styles.card} ${isAction ? styles.active : ''} ${player.is_folded ? styles.folded : ''} ${player.status === 'sitout' || player.status === 'afk' ? styles.away : ''} ${isMe ? styles.me : ''}`}
      onClick={() => { if (gameActive && !player.is_folded) onActFor(player.player_id); }}
    >
      {/* Glow effect for active player */}
      {isAction && <div className={styles.glow} />}

      <div className={styles.top}>
        <div className={styles.badges}>
          {isDealer && <span className={styles.dealerBadge}>D</span>}
          {isSB && <span className={styles.sbBadge}>SB</span>}
          {isBB && <span className={styles.bbBadge}>BB</span>}
          {player.is_folded && <span className={styles.foldBadge}>FOLD</span>}
          {(player.status === 'sitout' || player.status === 'afk') && <span className={styles.awayBadge}>离开</span>}
          {isAllIn && <span className={styles.allinBadge}>ALL-IN</span>}
        </div>
        <span className={styles.seat}>#{player.seat}</span>
      </div>

      <div className={styles.name}>
        {player.username}
        {isMe && <span className={styles.meBadge}>我</span>}
      </div>

      <div className={styles.chips}>{player.chips.toLocaleString()}</div>

      {gameActive && player.round_bet > 0 && (
        <div className={styles.bet}>下注 {player.round_bet}</div>
      )}

      {isAction && (
        <div className={styles.turnLabel}>轮到 TA</div>
      )}
    </div>
  );
}
