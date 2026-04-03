import { Coins } from 'lucide-react';
import type { GamePhase } from '../../stores/gameStore';
import styles from './PotDisplay.module.css';

const PHASE_LABELS: Record<GamePhase, string> = {
  lobby: '等待中', preflop: 'PRE-FLOP', flop: 'FLOP',
  turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN',
};

const PHASE_COLORS: Record<GamePhase, string> = {
  lobby: 'var(--color-text-muted)', preflop: '#3B82F6', flop: '#34D399',
  turn: '#FBBF24', river: '#F87171', showdown: '#E2B050',
};

interface Props {
  pot: number;
  phase: GamePhase;
  currentBetLevel: number;
  round: number;
  smallBlind: number;
  bigBlind: number;
}

export default function PotDisplay({ pot, phase, currentBetLevel, round, smallBlind, bigBlind }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.phaseRow}>
        <span className={styles.phaseBadge} style={{ borderColor: PHASE_COLORS[phase], color: PHASE_COLORS[phase] }}>
          {PHASE_LABELS[phase]}
        </span>
        <span className={styles.roundLabel}>R{round}</span>
        <span className={styles.blindsLabel}>{smallBlind}/{bigBlind}</span>
      </div>
      {phase !== 'lobby' && (
        <div className={styles.potRow}>
          <Coins size={18} className={styles.potIcon} />
          <span className={styles.potValue}>{pot.toLocaleString()}</span>
          {currentBetLevel > 0 && (
            <span className={styles.betLevel}>跟注 {currentBetLevel}</span>
          )}
        </div>
      )}
    </div>
  );
}
