import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import type { Player, WsMessage } from '../stores/gameStore';

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

function makeRoomState(overrides: Record<string, unknown> = {}) {
  return {
    room_code: 'ABC123',
    room_name: 'Test Room',
    current_round: 0,
    status: 'active',
    small_blind: 5,
    big_blind: 10,
    game_phase: 'lobby',
    dealer_seat: null,
    action_seat: null,
    pot: 0,
    current_bet_level: 0,
    players: [
      makePlayer({ player_id: 'p1', username: 'Alice', seat: 1 }),
      makePlayer({ player_id: 'p2', username: 'Bob', seat: 2 }),
      makePlayer({ player_id: 'p3', username: 'Charlie', seat: 3 }),
    ],
    transactions: [],
    my_player_id: 'p1',
    is_creator: true,
    ...overrides,
  };
}

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().clearSession();
  });

  describe('setRoomState', () => {
    it('should set room state from API response', () => {
      const state = makeRoomState();
      useGameStore.getState().setRoomState(state);

      const s = useGameStore.getState();
      expect(s.roomCode).toBe('ABC123');
      expect(s.roomName).toBe('Test Room');
      expect(s.players).toHaveLength(3);
      expect(s.playerId).toBe('p1');
      expect(s.isCreator).toBe(true);
      expect(s.gamePhase).toBe('lobby');
    });

    it('should reset bettingComplete on setRoomState', () => {
      const store = useGameStore.getState();
      store.setRoomState(makeRoomState());
      expect(useGameStore.getState().bettingComplete).toBe(false);
    });
  });

  describe('clearSession', () => {
    it('should reset all state', () => {
      useGameStore.getState().setRoomState(makeRoomState());
      useGameStore.getState().clearSession();

      const s = useGameStore.getState();
      expect(s.roomCode).toBeNull();
      expect(s.players).toHaveLength(0);
      expect(s.playerId).toBeNull();
    });
  });

  describe('handleWsMessage - hand_started', () => {
    it('should update phase, dealer, action, pot, players', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      const msg: WsMessage = {
        type: 'hand_started',
        data: {
          round: 1,
          phase: 'preflop',
          dealer_seat: 1,
          action_seat: 3,
          pot: 15,
          current_bet_level: 10,
          players: [
            { player_id: 'p1', chips: 995, round_bet: 5, hand_bet: 5, is_folded: false, status: 'online' },
            { player_id: 'p2', chips: 990, round_bet: 10, hand_bet: 10, is_folded: false, status: 'online' },
            { player_id: 'p3', chips: 1000, round_bet: 0, hand_bet: 0, is_folded: false, status: 'online' },
          ],
        },
      };
      useGameStore.getState().handleWsMessage(msg);

      const s = useGameStore.getState();
      expect(s.gamePhase).toBe('preflop');
      expect(s.dealerSeat).toBe(1);
      expect(s.actionSeat).toBe(3);
      expect(s.pot).toBe(15);
      expect(s.currentBetLevel).toBe(10);
      expect(s.currentRound).toBe(1);
      expect(s.bettingComplete).toBe(false);

      const sb = s.players.find(p => p.player_id === 'p1')!;
      expect(sb.chips).toBe(995);
      expect(sb.round_bet).toBe(5);
    });
  });

  describe('handleWsMessage - player_acted', () => {
    it('should update player chips and advance action', () => {
      useGameStore.getState().setRoomState(makeRoomState({
        game_phase: 'preflop',
        action_seat: 3,
        pot: 15,
        current_bet_level: 10,
      }));

      const msg: WsMessage = {
        type: 'player_acted',
        data: {
          player_id: 'p3',
          action: 'call',
          amount: 10,
          chips: 990,
          round_bet: 10,
          pot: 25,
          current_bet_level: 10,
          action_seat: 1,
          phase: 'preflop',
          betting_complete: false,
        },
      };
      useGameStore.getState().handleWsMessage(msg);

      const s = useGameStore.getState();
      expect(s.pot).toBe(25);
      expect(s.actionSeat).toBe(1);
      expect(s.bettingComplete).toBe(false);
      const p3 = s.players.find(p => p.player_id === 'p3')!;
      expect(p3.chips).toBe(990);
      expect(p3.round_bet).toBe(10);
    });

    it('should mark fold on player', () => {
      useGameStore.getState().setRoomState(makeRoomState({
        game_phase: 'preflop',
        action_seat: 3,
      }));

      useGameStore.getState().handleWsMessage({
        type: 'player_acted',
        data: {
          player_id: 'p3', action: 'fold', amount: 0,
          chips: 1000, round_bet: 0, pot: 15,
          action_seat: 1, phase: 'preflop', betting_complete: false,
        },
      });

      const p3 = useGameStore.getState().players.find(p => p.player_id === 'p3')!;
      expect(p3.is_folded).toBe(true);
    });

    it('should set bettingComplete when round ends', () => {
      useGameStore.getState().setRoomState(makeRoomState({
        game_phase: 'preflop',
        action_seat: 2,
      }));

      useGameStore.getState().handleWsMessage({
        type: 'player_acted',
        data: {
          player_id: 'p2', action: 'call', amount: 0,
          chips: 990, round_bet: 10, pot: 30,
          action_seat: null, phase: 'preflop', betting_complete: true,
        },
      });

      expect(useGameStore.getState().bettingComplete).toBe(true);
      expect(useGameStore.getState().actionSeat).toBeNull();
    });
  });

  describe('handleWsMessage - phase_advanced', () => {
    it('should advance phase and reset round bets', () => {
      useGameStore.getState().setRoomState(makeRoomState({
        game_phase: 'preflop',
        pot: 30,
        players: [
          makePlayer({ player_id: 'p1', round_bet: 10 }),
          makePlayer({ player_id: 'p2', round_bet: 10 }),
          makePlayer({ player_id: 'p3', round_bet: 10 }),
        ],
      }));

      useGameStore.getState().handleWsMessage({
        type: 'phase_advanced',
        data: {
          phase: 'flop',
          action_seat: 2,
          pot: 30,
          current_bet_level: 0,
          players: [
            { player_id: 'p1', round_bet: 0 },
            { player_id: 'p2', round_bet: 0 },
            { player_id: 'p3', round_bet: 0 },
          ],
        },
      });

      const s = useGameStore.getState();
      expect(s.gamePhase).toBe('flop');
      expect(s.actionSeat).toBe(2);
      expect(s.currentBetLevel).toBe(0);
      expect(s.bettingComplete).toBe(false);
      s.players.forEach(p => expect(p.round_bet).toBe(0));
    });
  });

  describe('handleWsMessage - hand_settled', () => {
    it('should reset to lobby and update chips', () => {
      useGameStore.getState().setRoomState(makeRoomState({
        game_phase: 'showdown',
        pot: 30,
      }));

      useGameStore.getState().handleWsMessage({
        type: 'hand_settled',
        data: {
          winners: [{ player_id: 'p1', username: 'Alice', amount: 30, chips: 1030 }],
          round: 1,
          players: [
            { player_id: 'p1', chips: 1030 },
            { player_id: 'p2', chips: 990 },
            { player_id: 'p3', chips: 990 },
          ],
        },
      });

      const s = useGameStore.getState();
      expect(s.gamePhase).toBe('lobby');
      expect(s.pot).toBe(0);
      expect(s.actionSeat).toBeNull();
      expect(s.bettingComplete).toBe(false);
      expect(s.players.find(p => p.player_id === 'p1')!.chips).toBe(1030);
    });
  });

  describe('handleWsMessage - hand_aborted', () => {
    it('should reset to lobby and restore chips', () => {
      useGameStore.getState().setRoomState(makeRoomState({
        game_phase: 'flop',
        pot: 60,
        action_seat: 2,
      }));

      useGameStore.getState().handleWsMessage({
        type: 'hand_aborted',
        data: {
          round: 1,
          players: [
            { player_id: 'p1', chips: 1000, round_bet: 0, hand_bet: 0, is_folded: false },
            { player_id: 'p2', chips: 1000, round_bet: 0, hand_bet: 0, is_folded: false },
            { player_id: 'p3', chips: 1000, round_bet: 0, hand_bet: 0, is_folded: false },
          ],
        },
      });

      const s = useGameStore.getState();
      expect(s.gamePhase).toBe('lobby');
      expect(s.pot).toBe(0);
      expect(s.actionSeat).toBeNull();
      expect(s.bettingComplete).toBe(false);
      s.players.forEach(p => {
        expect(p.chips).toBe(1000);
        expect(p.round_bet).toBe(0);
        expect(p.hand_bet).toBe(0);
        expect(p.is_folded).toBe(false);
      });
    });
  });

  describe('handleWsMessage - player_joined', () => {
    it('should add new player', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'player_joined',
        data: {
          player_id: 'p4', username: 'David',
          chips: 1000, seat: 4, status: 'online',
        },
      });

      expect(useGameStore.getState().players).toHaveLength(4);
      const p4 = useGameStore.getState().players.find(p => p.player_id === 'p4')!;
      expect(p4.username).toBe('David');
      expect(p4.seat).toBe(4);
    });

    it('should reactivate existing player', () => {
      useGameStore.getState().setRoomState(makeRoomState({
        players: [
          makePlayer({ player_id: 'p1', is_active: false, chips: 500 }),
        ],
      }));

      useGameStore.getState().handleWsMessage({
        type: 'player_joined',
        data: { player_id: 'p1', username: 'Alice', chips: 1000, status: 'online' },
      });

      const p1 = useGameStore.getState().players.find(p => p.player_id === 'p1')!;
      expect(p1.is_active).toBe(true);
      expect(p1.chips).toBe(1000);
    });
  });

  describe('handleWsMessage - chips_updated', () => {
    it('should update player chips', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'chips_updated',
        data: { player_id: 'p1', username: 'Alice', chips: 2000, amount: 1000, reason: 'rebuy' },
      });

      expect(useGameStore.getState().players.find(p => p.player_id === 'p1')!.chips).toBe(2000);
    });
  });

  describe('handleWsMessage - blinds_updated', () => {
    it('should update blind values', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'blinds_updated',
        data: { small_blind: 10, big_blind: 20 },
      });

      const s = useGameStore.getState();
      expect(s.smallBlind).toBe(10);
      expect(s.bigBlind).toBe(20);
    });
  });

  describe('handleWsMessage - player_status', () => {
    it('should update player status', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'player_status',
        data: { player_id: 'p1', status: 'sitout' },
      });

      expect(useGameStore.getState().players.find(p => p.player_id === 'p1')!.status).toBe('sitout');
    });
  });

  describe('handleWsMessage - player_role_changed', () => {
    it('should update player role and seat', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'player_role_changed',
        data: { player_id: 'p1', role: 'observer', seat: null, chips: 1000 },
      });

      const p1 = useGameStore.getState().players.find(p => p.player_id === 'p1')!;
      expect(p1.role).toBe('observer');
      expect(p1.seat).toBeNull();
    });
  });

  describe('handleWsMessage - seats_updated', () => {
    it('should update seat assignments', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'seats_updated',
        data: {
          players: [
            { player_id: 'p1', seat: 3 },
            { player_id: 'p2', seat: 1 },
            { player_id: 'p3', seat: 2 },
          ],
        },
      });

      const s = useGameStore.getState();
      expect(s.players.find(p => p.player_id === 'p1')!.seat).toBe(3);
      expect(s.players.find(p => p.player_id === 'p2')!.seat).toBe(1);
    });
  });

  describe('handleWsMessage - player_kicked', () => {
    it('should deactivate kicked player', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'player_kicked',
        data: { player_id: 'p2', username: 'Bob' },
      });

      expect(useGameStore.getState().players.find(p => p.player_id === 'p2')!.is_active).toBe(false);
    });
  });

  describe('handleWsMessage - room_closed', () => {
    it('should set status to closed', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'room_closed',
        data: {},
      });

      expect(useGameStore.getState().status).toBe('closed');
    });
  });

  describe('handleWsMessage - transfer', () => {
    it('should update both players chips', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'transfer',
        data: {
          from: { player_id: 'p1', chips: 800 },
          to: { player_id: 'p2', chips: 1200 },
        },
      });

      const s = useGameStore.getState();
      expect(s.players.find(p => p.player_id === 'p1')!.chips).toBe(800);
      expect(s.players.find(p => p.player_id === 'p2')!.chips).toBe(1200);
    });
  });

  describe('handleWsMessage - player_left', () => {
    it('should mark player as inactive and update game state', () => {
      useGameStore.getState().setRoomState(makeRoomState({
        game_phase: 'preflop',
        action_seat: 2,
      }));

      useGameStore.getState().handleWsMessage({
        type: 'player_left',
        data: {
          player_id: 'p2',
          username: 'Bob',
          seat: 2,
          game_phase: 'preflop',
          action_seat: 3,
        },
      });

      const s = useGameStore.getState();
      const p2 = s.players.find(p => p.player_id === 'p2');
      expect(p2?.is_active).toBe(false);
      expect(p2?.seat).toBeNull();
      expect(p2?.status).toBe('offline');
      expect(p2?.is_folded).toBe(true);
      expect(s.actionSeat).toBe(3);
    });

    it('should add transaction log entry on player leave', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'player_left',
        data: {
          player_id: 'p1',
          username: 'Alice',
          seat: 1,
          game_phase: 'lobby',
          action_seat: null,
        },
      });

      const logs = useGameStore.getState().transactions;
      expect(logs[0].note).toContain('Alice');
      expect(logs[0].note).toContain('离开');
    });

    it('should update game phase to showdown when last player triggers it', () => {
      useGameStore.getState().setRoomState(makeRoomState({
        game_phase: 'preflop',
        action_seat: 1,
      }));

      useGameStore.getState().handleWsMessage({
        type: 'player_left',
        data: {
          player_id: 'p1',
          username: 'Alice',
          seat: 1,
          game_phase: 'showdown',
          action_seat: null,
        },
      });

      const s = useGameStore.getState();
      expect(s.gamePhase).toBe('showdown');
      expect(s.actionSeat).toBeNull();
    });
  });

  describe('transaction log', () => {
    it('should add log entries on hand_started', () => {
      useGameStore.getState().setRoomState(makeRoomState());

      useGameStore.getState().handleWsMessage({
        type: 'hand_started',
        data: {
          round: 1, phase: 'preflop', dealer_seat: 1,
          action_seat: 3, pot: 15, current_bet_level: 10, players: [],
        },
      });

      const logs = useGameStore.getState().transactions;
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].note).toContain('第 1 手开始');
    });

    it('should add log entries on player_acted', () => {
      useGameStore.getState().setRoomState(makeRoomState({
        game_phase: 'preflop',
        action_seat: 1,
      }));

      useGameStore.getState().handleWsMessage({
        type: 'player_acted',
        data: {
          player_id: 'p1', action: 'raise', amount: 30,
          chips: 970, round_bet: 30, pot: 45,
          action_seat: 2, phase: 'preflop', betting_complete: false,
        },
      });

      const logs = useGameStore.getState().transactions;
      expect(logs[0].note).toContain('Alice');
      expect(logs[0].note).toContain('加注');
    });

    it('should add log entry on hand_aborted', () => {
      useGameStore.getState().setRoomState(makeRoomState({ game_phase: 'flop' }));

      useGameStore.getState().handleWsMessage({
        type: 'hand_aborted',
        data: { round: 1, players: [] },
      });

      const logs = useGameStore.getState().transactions;
      expect(logs[0].note).toContain('对局终止');
    });

    it('should cap log at 100 entries', () => {
      useGameStore.getState().setRoomState(makeRoomState({ game_phase: 'preflop', action_seat: 1 }));

      for (let i = 0; i < 110; i++) {
        useGameStore.getState().handleWsMessage({
          type: 'player_acted',
          data: {
            player_id: 'p1', action: 'call', amount: 0,
            chips: 1000, round_bet: 0, pot: 0,
            action_seat: 1, phase: 'preflop', betting_complete: false,
          },
        });
      }

      expect(useGameStore.getState().transactions.length).toBeLessThanOrEqual(100);
    });
  });
});
