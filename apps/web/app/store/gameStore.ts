import { create } from 'zustand';

export enum GameState {
  LOBBY = 'LOBBY',
  COUNTDOWN = 'COUNTDOWN',
  PLAYING = 'PLAYING',
  RESULTS = 'RESULTS',
  FINISHED = 'FINISHED',
}

export interface Player {
  id: string;
  name: string;
  score?: number;
  isHost?: boolean;
}

export interface GameStoreState {
  code: string | null;
  state: GameState;
  players: Player[];
  currentRound: number;
  totalRounds: number;
  masterId: string | null | undefined;
  playerName: string | null;

  // Actions
  setCode: (code: string | null) => void;
  setState: (state: GameState) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updatePlayer: (playerId: string, partial: Partial<Player>) => void;
  updateScore: (playerId: string, score: number) => void;
  setCurrentRound: (round: number) => void;
  setTotalRounds: (total: number) => void;
  setMasterId: (masterId: string | null | undefined) => void;
  setPlayerName: (name: string | null) => void;
  resetGame: () => void;
}

const initialState = {
  code: null,
  state: GameState.LOBBY,
  players: [],
  currentRound: 0,
  totalRounds: 5,
  masterId: null,
  playerName: null,
};

export const useGameStore = create<GameStoreState>((set) => ({
  ...initialState,

  setCode: (code) => set({ code }),

  setState: (state) => set({ state }),

  setPlayers: (players) => set({ players }),

  addPlayer: (player) =>
    set((prev) => {
      const exists = prev.players.some((p) => p.id === player.id);
      if (exists) {
        return {
          players: prev.players.map((p) =>
            p.id === player.id ? { ...p, ...player } : p
          ),
        };
      }
      return {
        players: [...prev.players, { score: 0, ...player }],
      };
    }),

  removePlayer: (playerId) =>
    set((prev) => ({
      players: prev.players.filter((p) => p.id !== playerId),
    })),

  updatePlayer: (playerId, partial) =>
    set((prev) => ({
      players: prev.players.map((p) =>
        p.id === playerId ? { ...p, ...partial } : p
      ),
    })),

  updateScore: (playerId, score) =>
    set((prev) => ({
      players: prev.players.map((p) =>
        p.id === playerId ? { ...p, score } : p
      ),
    })),

  setCurrentRound: (currentRound) => set({ currentRound }),

  setTotalRounds: (totalRounds) => set({ totalRounds }),

  setMasterId: (masterId) => set({ masterId }),

  setPlayerName: (playerName) => set({ playerName }),

  resetGame: () => set(initialState),
}));
