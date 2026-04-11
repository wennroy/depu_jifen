import type { Player } from '../../stores/gameStore';
import PlayerCard from './PlayerCard';
import styles from './TableLayout.module.css';

interface Props {
  players: Player[];
  myPlayerId: string | null;
  dealerSeat: number | null;
  sbSeat: number | null;
  bbSeat: number | null;
  actionSeat: number | null;
  gameActive: boolean;
  onPlayerClick: (playerId: string) => void;
}

export default function TableLayout({ players, myPlayerId, dealerSeat, sbSeat, bbSeat, actionSeat, gameActive, onPlayerClick }: Props) {
  const useCircle = players.length <= 8;

  if (!useCircle) {
    return (
      <div className={styles.grid}>
        {players.map(p => (
          <PlayerCard key={p.player_id} player={p} isMe={p.player_id === myPlayerId}
            isDealer={p.seat === dealerSeat} isSB={p.seat === sbSeat} isBB={p.seat === bbSeat}
            isAction={p.seat === actionSeat} gameActive={gameActive} onActFor={onPlayerClick} />
        ))}
      </div>
    );
  }

  // Circle layout
  const count = players.length;
  // Find my index to put myself at the bottom
  const myIdx = players.findIndex(p => p.player_id === myPlayerId);
  const rotateOffset = myIdx >= 0 ? myIdx : 0;

  return (
    <div className={styles.tableContainer}>
      <div className={styles.feltOval} />
      <div className={styles.circle}>
        {players.map((p, i) => {
          // Reorder so "me" is at the bottom (180 degrees)
          const adjustedIdx = (i - rotateOffset + count) % count;
          // Angle: start from bottom (180deg), go clockwise
          const angle = (Math.PI) + (adjustedIdx / count) * 2 * Math.PI;
          // Ellipse radii (responsive via CSS variables)
          const xPct = 50 + Math.sin(angle) * 42; // 42% horizontal radius
          const yPct = 50 - Math.cos(angle) * 40; // 40% vertical radius

          return (
            <div
              key={p.player_id}
              className={styles.seatPosition}
              style={{
                left: `${xPct}%`,
                top: `${yPct}%`,
              }}
            >
              <PlayerCard player={p} isMe={p.player_id === myPlayerId}
                isDealer={p.seat === dealerSeat} isSB={p.seat === sbSeat} isBB={p.seat === bbSeat}
                isAction={p.seat === actionSeat} gameActive={gameActive} onActFor={onPlayerClick} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
