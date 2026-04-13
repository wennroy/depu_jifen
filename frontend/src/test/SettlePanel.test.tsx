import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettlePanel from '../components/room/SettlePanel';
import type { Player } from '../stores/gameStore';

vi.mock('../api/http', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { ok: true } }),
  },
}));

vi.mock('antd-mobile', () => ({
  Toast: { show: vi.fn() },
}));

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

describe('SettlePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display pot amount', () => {
    render(
      <SettlePanel
        roomCode="ABC123" playerToken="token" pot={100}
        players={[makePlayer()]} onSettled={() => {}}
      />
    );

    expect(screen.getByText(/底池 100/)).toBeInTheDocument();
  });

  it('should list only active non-folded players', () => {
    const players = [
      makePlayer({ player_id: 'p1', username: 'Alice' }),
      makePlayer({ player_id: 'p2', username: 'Bob', is_folded: true }),
      makePlayer({ player_id: 'p3', username: 'Charlie' }),
    ];

    render(
      <SettlePanel
        roomCode="ABC123" playerToken="token" pot={100}
        players={players} onSettled={() => {}}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('should show remaining amount initially', () => {
    render(
      <SettlePanel
        roomCode="ABC123" playerToken="token" pot={100}
        players={[makePlayer()]} onSettled={() => {}}
      />
    );

    expect(screen.getByText('剩余 100')).toBeInTheDocument();
  });

  it('should give all to player on name click', () => {
    render(
      <SettlePanel
        roomCode="ABC123" playerToken="token" pot={100}
        players={[
          makePlayer({ player_id: 'p1', username: 'Alice' }),
          makePlayer({ player_id: 'p2', username: 'Bob' }),
        ]} onSettled={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Alice'));
    expect(screen.getByText('分配完毕 ✓')).toBeInTheDocument();
  });

  it('should disable settle button when remaining is not 0', () => {
    render(
      <SettlePanel
        roomCode="ABC123" playerToken="token" pot={100}
        players={[makePlayer()]} onSettled={() => {}}
      />
    );

    const btn = screen.getByText('确认结算');
    expect(btn).toBeDisabled();
  });

  it('should enable settle button when fully distributed', () => {
    render(
      <SettlePanel
        roomCode="ABC123" playerToken="token" pot={100}
        players={[makePlayer({ player_id: 'p1', username: 'Alice' })]}
        onSettled={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Alice'));
    const btn = screen.getByText('确认结算');
    expect(btn).not.toBeDisabled();
  });

  it('should call settle-hand API on settle', async () => {
    const http = (await import('../api/http')).default;
    const onSettled = vi.fn();

    render(
      <SettlePanel
        roomCode="ABC123" playerToken="token" pot={100}
        players={[makePlayer({ player_id: 'p1', username: 'Alice' })]}
        onSettled={onSettled}
      />
    );

    fireEvent.click(screen.getByText('Alice'));
    fireEvent.click(screen.getByText('确认结算'));

    await vi.waitFor(() => {
      expect(http.post).toHaveBeenCalledWith(
        '/rooms/ABC123/settle-hand',
        { winners: [{ player_id: 'p1', amount: 100 }] },
        { headers: { 'X-User-Token': 'token' } }
      );
    });
  });
});
