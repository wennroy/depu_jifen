import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PotDisplay from '../components/room/PotDisplay';

// Mock PhaseCards since it has its own CSS
vi.mock('../components/room/PhaseCards', () => ({
  default: ({ phase }: { phase: string }) => <div data-testid="phase-cards">{phase}</div>,
}));

describe('PotDisplay', () => {
  it('should display phase label for lobby', () => {
    render(
      <PotDisplay pot={0} phase="lobby" currentBetLevel={0} round={0} smallBlind={5} bigBlind={10} />
    );

    expect(screen.getByText('等待中')).toBeInTheDocument();
  });

  it('should display phase label for preflop', () => {
    render(
      <PotDisplay pot={15} phase="preflop" currentBetLevel={10} round={1} smallBlind={5} bigBlind={10} />
    );

    expect(screen.getByText('PRE-FLOP')).toBeInTheDocument();
  });

  it('should display phase label for flop', () => {
    render(
      <PotDisplay pot={30} phase="flop" currentBetLevel={0} round={1} smallBlind={5} bigBlind={10} />
    );

    expect(screen.getByText('FLOP')).toBeInTheDocument();
  });

  it('should display round and blinds info', () => {
    render(
      <PotDisplay pot={0} phase="lobby" currentBetLevel={0} round={3} smallBlind={5} bigBlind={10} />
    );

    expect(screen.getByText('R3 · 5/10')).toBeInTheDocument();
  });

  it('should not show pot in lobby', () => {
    render(
      <PotDisplay pot={100} phase="lobby" currentBetLevel={0} round={0} smallBlind={5} bigBlind={10} />
    );

    expect(screen.queryByText('100')).not.toBeInTheDocument();
  });

  it('should show pot in active phases', () => {
    render(
      <PotDisplay pot={150} phase="preflop" currentBetLevel={10} round={1} smallBlind={5} bigBlind={10} />
    );

    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('should show bet level when > 0', () => {
    render(
      <PotDisplay pot={30} phase="flop" currentBetLevel={20} round={1} smallBlind={5} bigBlind={10} />
    );

    expect(screen.getByText('跟注 20')).toBeInTheDocument();
  });

  it('should not show bet level when 0', () => {
    render(
      <PotDisplay pot={30} phase="flop" currentBetLevel={0} round={1} smallBlind={5} bigBlind={10} />
    );

    expect(screen.queryByText(/跟注/)).not.toBeInTheDocument();
  });

  it('should display showdown phase label', () => {
    render(
      <PotDisplay pot={100} phase="showdown" currentBetLevel={0} round={1} smallBlind={5} bigBlind={10} />
    );

    expect(screen.getByText('SHOWDOWN')).toBeInTheDocument();
  });
});
