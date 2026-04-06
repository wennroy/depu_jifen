import { Coins } from 'lucide-react';
import type { GamePhase } from '../../stores/gameStore';
import PhaseCards from './PhaseCards';
import styles from './PotDisplay.module.css';

const PHASE_LABELS: Record<GamePhase, string> = {
  lobby: '等待中', preflop: 'PRE-FLOP', flop: 'FLOP',
  turn: 'TURN', river: 'RIVER', showdown: 'SHOWDOWN',
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
      <PhaseCards phase={phase} />
      <div className={styles.infoRow}>
        <span className={styles.phaseLabel}>{PHASE_LABELS[phase]}</span>
        <span className={styles.meta}>R{round} · {smallBlind}/{bigBlind}</span>
      </div>
      {phase !== 'lobby' && (
        <div className={styles.potRow}>
          <Coins size={16} className={styles.potIcon} />
          <span className={styles.potValue}>{pot.toLocaleString()}</span>
          {currentBetLevel > 0 && (
            <span className={styles.betLevel}>跟注 {currentBetLevel}</span>
          )}
        </div>
      )}
    </div>
  );
}
