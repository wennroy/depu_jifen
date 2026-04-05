import { create } from 'zustand';

export type GamePhase = 'lobby' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface Player {
  player_id: string;
  username: string;
  chips: number;
  is_active: boolean;
  seat: number | null;
  total_buyin: number;
  status: string;
  round_bet: number;
  hand_bet: number;
  is_folded: boolean;
}

export interface TransactionLog {
  id: number;
  tx_type: string;
  from_username: string | null;
  to_username: string | null;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface WsMessage {
  type: string;
  data: any;
}

interface GameStore {
  roomCode: string | null;
  roomName: string;
  playerId: string | null;
  currentRound: number;
  status: string;
  smallBlind: number;
  bigBlind: number;
  gamePhase: GamePhase;
  dealerSeat: number | null;
  actionSeat: number | null;
  pot: number;
  currentBetLevel: number;
  bettingComplete: boolean;
  players: Player[];
  transactions: TransactionLog[];
  wsConnected: boolean;

  setRoomState: (state: any) => void;
  setWsConnected: (v: boolean) => void;
  handleWsMessage: (msg: WsMessage) => void;
  clearSession: () => void;
}

const DEFAULT_PLAYER: Omit<Player, 'player_id' | 'username' | 'chips' | 'seat'> = {
  is_active: true, total_buyin: 0, status: 'online',
  round_bet: 0, hand_bet: 0, is_folded: false,
};

export const useGameStore = create<GameStore>((set, get) => ({
  roomCode: null, roomName: '', playerId: null,
  currentRound: 0, status: 'active', smallBlind: 5, bigBlind: 10,
  gamePhase: 'lobby', dealerSeat: null, actionSeat: null,
  pot: 0, currentBetLevel: 0, bettingComplete: false,
  players: [], transactions: [], wsConnected: false,

  setRoomState: (state) => set({
    roomCode: state.room_code, roomName: state.room_name,
    currentRound: state.current_round, status: state.status,
    smallBlind: state.small_blind, bigBlind: state.big_blind,
    gamePhase: state.game_phase, dealerSeat: state.dealer_seat,
    actionSeat: state.action_seat, pot: state.pot,
    currentBetLevel: state.current_bet_level,
    players: state.players, transactions: state.transactions,
    playerId: state.my_player_id, bettingComplete: false,
  }),

  setWsConnected: (v) => set({ wsConnected: v }),

  handleWsMessage: (msg: WsMessage) => {
    const state = get();
    switch (msg.type) {
      case 'player_joined': {
        const d = msg.data;
        const exists = state.players.find(p => p.player_id === d.player_id);
        if (exists) {
          set({ players: state.players.map(p =>
            p.player_id === d.player_id ? { ...p, is_active: true, chips: d.chips, status: d.status || 'online' } : p
          )});
        } else {
          set({ players: [...state.players, {
            ...DEFAULT_PLAYER, player_id: d.player_id, username: d.username,
            chips: d.chips, seat: d.seat || null, total_buyin: d.chips,
            status: d.status || 'online',
          }]});
        }
        break;
      }
      case 'hand_started': {
        const d = msg.data;
        set({
          gamePhase: d.phase, dealerSeat: d.dealer_seat,
          actionSeat: d.action_seat, pot: d.pot,
          currentBetLevel: d.current_bet_level, currentRound: d.round,
          bettingComplete: false,
          players: state.players.map(p => {
            const u = d.players?.find((u: any) => u.player_id === p.player_id);
            return u ? { ...p, ...u } : p;
          }),
        });
        break;
      }
      case 'player_acted': {
        const d = msg.data;
        set({
          pot: d.pot, currentBetLevel: d.current_bet_level ?? state.currentBetLevel,
          actionSeat: d.action_seat, gamePhase: d.phase,
          bettingComplete: d.betting_complete || false,
          players: state.players.map(p =>
            p.player_id === d.player_id
              ? { ...p, chips: d.chips, round_bet: d.round_bet, is_folded: d.action === 'fold' ? true : p.is_folded }
              : p
          ),
        });
        break;
      }
      case 'phase_advanced': {
        const d = msg.data;
        set({
          gamePhase: d.phase, actionSeat: d.action_seat, pot: d.pot,
          currentBetLevel: d.current_bet_level || 0, bettingComplete: false,
          players: state.players.map(p => {
            const u = d.players?.find((u: any) => u.player_id === p.player_id);
            return u ? { ...p, round_bet: u.round_bet } : { ...p, round_bet: 0 };
          }),
        });
        break;
      }
      case 'hand_settled': {
        const d = msg.data;
        set({
          gamePhase: 'lobby', pot: 0, currentBetLevel: 0, actionSeat: null,
          bettingComplete: false, currentRound: d.round,
          players: state.players.map(p => {
            const u = d.players?.find((u: any) => u.player_id === p.player_id);
            return u ? { ...p, chips: u.chips, round_bet: 0, hand_bet: 0, is_folded: false } : p;
          }),
        });
        break;
      }
      case 'chips_updated': {
        const d = msg.data;
        set({ players: state.players.map(p => p.player_id === d.player_id ? { ...p, chips: d.chips } : p) });
        break;
      }
      case 'transfer': {
        const d = msg.data;
        set({ players: state.players.map(p => {
          if (p.player_id === d.from.player_id) return { ...p, chips: d.from.chips };
          if (p.player_id === d.to.player_id) return { ...p, chips: d.to.chips };
          return p;
        })});
        break;
      }
      case 'blinds_updated': {
        set({ smallBlind: msg.data.small_blind, bigBlind: msg.data.big_blind });
        break;
      }
      case 'player_status': {
        set({ players: state.players.map(p =>
          p.player_id === msg.data.player_id ? { ...p, status: msg.data.status } : p
        )});
        break;
      }
      case 'seats_updated': {
        const updates = msg.data.players as { player_id: string; seat: number }[];
        set({ players: state.players.map(p => {
          const u = updates.find(u => u.player_id === p.player_id);
          return u ? { ...p, seat: u.seat } : p;
        })});
        break;
      }
      case 'player_kicked': {
        set({ players: state.players.map(p =>
          p.player_id === msg.data.player_id ? { ...p, is_active: false } : p
        )});
        break;
      }
      case 'room_closed': {
        set({ status: 'closed' });
        break;
      }
    }
  },

  clearSession: () => set({
    roomCode: null, roomName: '', playerId: null,
    currentRound: 0, status: 'active', smallBlind: 5, bigBlind: 10,
    gamePhase: 'lobby', dealerSeat: null, actionSeat: null,
    pot: 0, currentBetLevel: 0, bettingComplete: false,
    players: [], transactions: [], wsConnected: false,
  }),
}));
