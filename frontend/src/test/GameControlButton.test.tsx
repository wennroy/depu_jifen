import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GameControlButton from '../components/room/GameControlButton';

// Mock http module
vi.mock('../api/http', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { ok: true } }),
  },
}));

// Mock antd-mobile
vi.mock('antd-mobile', () => ({
  Toast: { show: vi.fn() },
  Dialog: { confirm: vi.fn().mockResolvedValue(true) },
}));

describe('GameControlButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('lobby phase', () => {
    it('should render start button in lobby', () => {
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="lobby"
          bettingComplete={false}
        />
      );

      expect(screen.getByText('开始游戏')).toBeInTheDocument();
    });

    it('should not render abort button in lobby', () => {
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="lobby"
          bettingComplete={false}
        />
      );

      expect(screen.queryByText('终止对局')).not.toBeInTheDocument();
    });

    it('should call start-hand API on click', async () => {
      const http = (await import('../api/http')).default;
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="lobby"
          bettingComplete={false}
        />
      );

      fireEvent.click(screen.getByText('开始游戏'));
      expect(http.post).toHaveBeenCalledWith(
        '/rooms/ABC123/start-hand',
        {},
        { headers: { 'X-User-Token': 'token123' } }
      );
    });
  });

  describe('active game phase', () => {
    it('should render abort button during preflop', () => {
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="preflop"
          bettingComplete={false}
        />
      );

      expect(screen.getByText('终止对局')).toBeInTheDocument();
    });

    it('should render abort button during flop', () => {
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="flop"
          bettingComplete={false}
        />
      );

      expect(screen.getByText('终止对局')).toBeInTheDocument();
    });

    it('should render abort button during showdown', () => {
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="showdown"
          bettingComplete={false}
        />
      );

      expect(screen.getByText('终止对局')).toBeInTheDocument();
    });

    it('should not render start button during active phase', () => {
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="preflop"
          bettingComplete={false}
        />
      );

      expect(screen.queryByText('开始游戏')).not.toBeInTheDocument();
    });

    it('should call abort-hand API on confirm', async () => {
      const http = (await import('../api/http')).default;
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="preflop"
          bettingComplete={false}
        />
      );

      fireEvent.click(screen.getByText('终止对局'));
      await vi.waitFor(() => {
        expect(http.post).toHaveBeenCalledWith(
          '/rooms/ABC123/abort-hand',
          {},
          { headers: { 'X-User-Token': 'token123' } }
        );
      });
    });
  });

  describe('next round button', () => {
    it('should render next round button when betting complete (not showdown)', () => {
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="preflop"
          bettingComplete={true}
        />
      );

      expect(screen.getByText('下一轮')).toBeInTheDocument();
    });

    it('should not render next round button in showdown even if bettingComplete', () => {
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="showdown"
          bettingComplete={true}
        />
      );

      expect(screen.queryByText('下一轮')).not.toBeInTheDocument();
    });

    it('should not render next round when betting not complete', () => {
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="flop"
          bettingComplete={false}
        />
      );

      expect(screen.queryByText('下一轮')).not.toBeInTheDocument();
    });

    it('should call next-round API on click', async () => {
      const http = (await import('../api/http')).default;
      render(
        <GameControlButton
          roomCode="ABC123"
          playerToken="token123"
          phase="flop"
          bettingComplete={true}
        />
      );

      fireEvent.click(screen.getByText('下一轮'));
      expect(http.post).toHaveBeenCalledWith(
        '/rooms/ABC123/next-round',
        {},
        { headers: { 'X-User-Token': 'token123' } }
      );
    });
  });
});
