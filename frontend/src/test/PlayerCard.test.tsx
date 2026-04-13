import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlayerCard from '../components/room/PlayerCard';
import type { Player } from '../stores/gameStore';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    player_id: 'p1',
    username: 'Alice',
    chips: 1000,
    is_active: true,
    seat: 1,
    total_buyin: 1000,
    status: 'online',
    role: 'player',
    round_bet: 0,
    hand_bet: 0,
    is_folded: false,
    ...overrides,
  };
}

describe('PlayerCard', () => {
  const noop = () => {};

  it('should display player username and chips', () => {
    render(
      <PlayerCard
        player={makePlayer()} isMe={false} isDealer={false}
        isSB={false} isBB={false} isAction={false} gameActive={false}
        onActFor={noop}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('should display seat number', () => {
    render(
      <PlayerCard
        player={makePlayer({ seat: 3 })} isMe={false} isDealer={false}
        isSB={false} isBB={false} isAction={false} gameActive={false}
        onActFor={noop}
      />
    );

    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('should show dealer badge', () => {
    render(
      <PlayerCard
        player={makePlayer()} isMe={false} isDealer={true}
        isSB={false} isBB={false} isAction={false} gameActive={false}
        onActFor={noop}
      />
    );

    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('should show SB badge', () => {
    render(
      <PlayerCard
        player={makePlayer()} isMe={false} isDealer={false}
        isSB={true} isBB={false} isAction={false} gameActive={false}
        onActFor={noop}
      />
    );

    expect(screen.getByText('SB')).toBeInTheDocument();
  });

  it('should show BB badge', () => {
    render(
      <PlayerCard
        player={makePlayer()} isMe={false} isDealer={false}
        isSB={false} isBB={true} isAction={false} gameActive={false}
        onActFor={noop}
      />
    );

    expect(screen.getByText('BB')).toBeInTheDocument();
  });

  it('should show FOLD badge when folded', () => {
    render(
      <PlayerCard
        player={makePlayer({ is_folded: true })} isMe={false} isDealer={false}
        isSB={false} isBB={false} isAction={false} gameActive={true}
        onActFor={noop}
      />
    );

    expect(screen.getByText('FOLD')).toBeInTheDocument();
  });

  it('should show ALL-IN badge when chips are 0 with bet', () => {
    render(
      <PlayerCard
        player={makePlayer({ chips: 0, hand_bet: 500 })} isMe={false} isDealer={false}
        isSB={false} isBB={false} isAction={false} gameActive={true}
        onActFor={noop}
      />
    );

    expect(screen.getByText('ALL-IN')).toBeInTheDocument();
  });

  it('should show 我 badge for current player', () => {
    render(
      <PlayerCard
        player={makePlayer()} isMe={true} isDealer={false}
        isSB={false} isBB={false} isAction={false} gameActive={false}
        onActFor={noop}
      />
    );

    expect(screen.getByText('我')).toBeInTheDocument();
  });

  it('should show away badge for sitout player', () => {
    render(
      <PlayerCard
        player={makePlayer({ status: 'sitout' })} isMe={false} isDealer={false}
        isSB={false} isBB={false} isAction={false} gameActive={false}
        onActFor={noop}
      />
    );

    expect(screen.getByText('离开')).toBeInTheDocument();
  });

  it('should show bet amount during active game', () => {
    render(
      <PlayerCard
        player={makePlayer({ round_bet: 50 })} isMe={false} isDealer={false}
        isSB={false} isBB={false} isAction={false} gameActive={true}
        onActFor={noop}
      />
    );

    expect(screen.getByText('下注 50')).toBeInTheDocument();
  });

  it('should not show bet when round_bet is 0', () => {
    render(
      <PlayerCard
        player={makePlayer({ round_bet: 0 })} isMe={false} isDealer={false}
        isSB={false} isBB={false} isAction={false} gameActive={true}
        onActFor={noop}
      />
    );

    expect(screen.queryByText(/下注/)).not.toBeInTheDocument();
  });

  it('should show turn label when isAction', () => {
    render(
      <PlayerCard
        player={makePlayer()} isMe={false} isDealer={false}
        isSB={false} isBB={false} isAction={true} gameActive={true}
        onActFor={noop}
      />
    );

    expect(screen.getByText('轮到 TA')).toBeInTheDocument();
  });

  it('should show multiple badges simultaneously', () => {
    render(
      <PlayerCard
        player={makePlayer()} isMe={true} isDealer={true}
        isSB={true} isBB={false} isAction={true} gameActive={true}
        onActFor={noop}
      />
    );

    expect(screen.getByText('D')).toBeInTheDocument();
    expect(screen.getByText('SB')).toBeInTheDocument();
    expect(screen.getByText('我')).toBeInTheDocument();
    expect(screen.getByText('轮到 TA')).toBeInTheDocument();
  });
});
