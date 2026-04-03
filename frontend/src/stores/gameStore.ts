import { create } from 'zustand';

export interface Player {
  player_id: string;
  username: string;
  chips: number;
  is_active: boolean;
  seat: number | null;
  total_buyin: number;
  is_preassigned: boolean;
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
  playerToken: string | null;
  adminToken: string | null;
  playerId: string | null;
  username: string | null;
  currentRound: number;
  status: string;
  smallBlind: number;
  bigBlind: number;
  players: Player[];
  transactions: TransactionLog[];
  isAdmin: boolean;
  wsConnected: boolean;

  setIdentity: (params: {
    roomCode: string;
    playerToken: string;
    playerId: string;
    username: string;
    adminToken?: string;
  }) => void;
  setRoomState: (state: {
    room_code: string;
    room_name: string;
    current_round: number;
    status: string;
    small_blind: number;
    big_blind: number;
    players: Player[];
    transactions: TransactionLog[];
    my_player_id: string;
    is_admin: boolean;
  }) => void;
  setIsAdmin: (v: boolean) => void;
  setWsConnected: (v: boolean) => void;
  handleWsMessage: (msg: WsMessage) => void;
  clearSession: () => void;
}

const STORAGE_PREFIX = 'depu_';

export const getStoredTokens = (roomCode: string) => ({
  playerToken: localStorage.getItem(`${STORAGE_PREFIX}${roomCode}_pt`),
  adminToken: localStorage.getItem(`${STORAGE_PREFIX}${roomCode}_at`),
  playerId: localStorage.getItem(`${STORAGE_PREFIX}${roomCode}_pid`),
  username: localStorage.getItem(`${STORAGE_PREFIX}${roomCode}_un`),
});

export const storeTokens = (roomCode: string, params: {
  playerToken: string;
  playerId: string;
  username: string;
  adminToken?: string;
}) => {
  localStorage.setItem(`${STORAGE_PREFIX}${roomCode}_pt`, params.playerToken);
  localStorage.setItem(`${STORAGE_PREFIX}${roomCode}_pid`, params.playerId);
  localStorage.setItem(`${STORAGE_PREFIX}${roomCode}_un`, params.username);
  if (params.adminToken) {
    localStorage.setItem(`${STORAGE_PREFIX}${roomCode}_at`, params.adminToken);
  }
};

export const useGameStore = create<GameStore>((set, get) => ({
  roomCode: null,
  roomName: '',
  playerToken: null,
  adminToken: null,
  playerId: null,
  username: null,
  currentRound: 0,
  status: 'active',
  smallBlind: 5,
  bigBlind: 10,
  players: [],
  transactions: [],
  isAdmin: false,
  wsConnected: false,

  setIdentity: ({ roomCode, playerToken, playerId, username, adminToken }) => {
    storeTokens(roomCode, { playerToken, playerId, username, adminToken });
    set({ roomCode, playerToken, playerId, username, adminToken: adminToken || null });
  },

  setRoomState: (state) => {
    set({
      roomCode: state.room_code,
      roomName: state.room_name,
      currentRound: state.current_round,
      status: state.status,
      smallBlind: state.small_blind,
      bigBlind: state.big_blind,
      players: state.players,
      transactions: state.transactions,
      playerId: state.my_player_id,
      isAdmin: state.is_admin,
    });
  },

  setIsAdmin: (v) => set({ isAdmin: v }),
  setWsConnected: (v) => set({ wsConnected: v }),

  handleWsMessage: (msg: WsMessage) => {
    const state = get();
    switch (msg.type) {
      case 'player_joined': {
        const d = msg.data;
        const exists = state.players.find(p => p.player_id === d.player_id);
        if (exists) {
          // Preassigned player now active
          set({ players: state.players.map(p =>
            p.player_id === d.player_id ? { ...p, is_active: true, chips: d.chips } : p
          )});
        } else {
          set({ players: [...state.players, {
            player_id: d.player_id, username: d.username, chips: d.chips,
            is_active: true, seat: d.seat || null, total_buyin: d.chips,
            is_preassigned: false,
          }]});
        }
        break;
      }
      case 'player_preassigned': {
        const d = msg.data;
        set({ players: [...state.players, {
          player_id: d.player_id, username: d.username, chips: d.chips,
          is_active: false, seat: d.seat, total_buyin: d.chips,
          is_preassigned: true,
        }]});
        break;
      }
      case 'chips_updated': {
        const d = msg.data;
        set({
          players: state.players.map(p =>
            p.player_id === d.player_id ? { ...p, chips: d.chips } : p
          ),
        });
        break;
      }
      case 'round_advanced': {
        set({ currentRound: msg.data.round });
        break;
      }
      case 'round_settled': {
        const settlements = msg.data.settlements as { player_id: string; new_chips: number }[];
        set({
          currentRound: msg.data.round,
          players: state.players.map(p => {
            const s = settlements.find(s => s.player_id === p.player_id);
            return s ? { ...p, chips: s.new_chips } : p;
          }),
        });
        break;
      }
      case 'transfer': {
        const d = msg.data;
        set({
          players: state.players.map(p => {
            if (p.player_id === d.from.player_id) return { ...p, chips: d.from.chips };
            if (p.player_id === d.to.player_id) return { ...p, chips: d.to.chips };
            return p;
          }),
        });
        break;
      }
      case 'blinds_updated': {
        set({ smallBlind: msg.data.small_blind, bigBlind: msg.data.big_blind });
        break;
      }
      case 'player_kicked': {
        set({
          players: state.players.map(p =>
            p.player_id === msg.data.player_id ? { ...p, is_active: false } : p
          ),
        });
        break;
      }
      case 'room_closed': {
        set({ status: 'closed' });
        break;
      }
    }
  },

  clearSession: () => {
    set({
      roomCode: null, roomName: '', playerToken: null, adminToken: null,
      playerId: null, username: null, currentRound: 0, status: 'active',
      smallBlind: 5, bigBlind: 10,
      players: [], transactions: [], isAdmin: false, wsConnected: false,
    });
  },
}));
