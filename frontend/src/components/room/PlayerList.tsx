import type { Player } from '../../stores/gameStore';
import styles from './PlayerList.module.css';

interface Props {
  players: Player[];
  myPlayerId: string;
  isAdmin: boolean;
  onTransfer: (playerId: string) => void;
  onAdjust?: (playerId: string) => void;
}

export default function PlayerList({ players, myPlayerId, isAdmin, onTransfer, onAdjust }: Props) {
  const activePlayers = players.filter(p => p.is_active);
  const sorted = [...activePlayers].sort((a, b) => b.chips - a.chips);

  return (
    <div className={styles.container}>
      <div className={styles.sectionTitle}>玩家 ({activePlayers.length})</div>
      <div className={styles.grid}>
        {sorted.map((player, idx) => {
          const isMe = player.player_id === myPlayerId;
          return (
            <div
              key={player.player_id}
              className={`${styles.card} ${isMe ? styles.cardMe : ''}`}
              onClick={() => {
                if (!isMe) onTransfer(player.player_id);
              }}
            >
              <div className={styles.cardTop}>
                <div className={styles.rank}>
                  {idx === 0 ? '👑' : `#${idx + 1}`}
                </div>
                {isAdmin && !isMe && onAdjust && (
                  <button
                    className={styles.adjustBtn}
                    onClick={(e) => { e.stopPropagation(); onAdjust(player.player_id); }}
                  >
                    调整
                  </button>
                )}
              </div>
              <div className={styles.username}>
                {player.username}
                {isMe && <span className={styles.meBadge}>我</span>}
              </div>
              <div className={styles.chips}>{player.chips.toLocaleString()}</div>
              {!isMe && (
                <div className={styles.tapHint}>点击转账</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
