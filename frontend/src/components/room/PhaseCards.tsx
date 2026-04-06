import type { GamePhase } from '../../stores/gameStore';
import styles from './PhaseCards.module.css';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS: Record<string, string> = { '♠': '#EDEDEF', '♥': '#F87171', '♦': '#60A5FA', '♣': '#34D399' };

// How many cards are "revealed" per phase
const REVEALED: Record<GamePhase, number> = {
  lobby: 0, preflop: 0, flop: 3, turn: 4, river: 5, showdown: 5,
};

// Deterministic "random" suits per position (just decorative)
const CARD_SUITS = [SUITS[0], SUITS[1], SUITS[2], SUITS[3], SUITS[0]];

interface Props {
  phase: GamePhase;
}

export default function PhaseCards({ phase }: Props) {
  const revealed = REVEALED[phase];

  return (
    <div className={styles.container}>
      {[0, 1, 2, 3, 4].map(i => {
        const isRevealed = i < revealed;
        const suit = CARD_SUITS[i];
        return (
          <div key={i} className={`${styles.card} ${isRevealed ? styles.revealed : styles.faceDown}`}>
            {isRevealed ? (
              <span className={styles.suit} style={{ color: SUIT_COLORS[suit] }}>{suit}</span>
            ) : (
              <div className={styles.backPattern} />
            )}
          </div>
        );
      })}
    </div>
  );
}
