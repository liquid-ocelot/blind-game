import { create } from 'zustand';
import { GameMode, Team, DEFAULT_TEAMS, Player as SharedPlayer } from '@blindtest/shared';

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
  teamId?: string | null;
  isHost?: boolean;
}

export interface GameStoreState {
  code: string | null;
  state: GameState;
  players: Player[];
  currentRound: number;
  totalRounds: number;
  gameMode: GameMode;
  teams: Team[];
  correctPlayers: string[];
  correctTeams: string[];
  masterId: string | null | undefined;
  playerName: string | null;

  // Actions
  setCode: (code: string | null) => void;
  setState: (state: GameState) => void;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  updatePlayer: (playerId: string, partial: Partial<Player>) => void;
  setPlayerTeam: (playerId: string, teamId: string | null) => void;
  updateScore: (playerId: string, score: number) => void;
  setCurrentRound: (round: number) => void;
  setTotalRounds: (total: number) => void;
  setGameMode: (gameMode: GameMode) => void;
  setTeams: (teams: Team[]) => void;
  setCorrectPlayers: (correctPlayers: string[]) => void;
  setCorrectTeams: (correctTeams: string[]) => void;
  addCorrectAnswer: (playerId: string, teamId?: string | null) => void;
  clearCorrectAnswers: () => void;
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
  gameMode: GameMode.SOLO,
  teams: DEFAULT_TEAMS.slice(0, 2),
  correctPlayers: [],
  correctTeams: [],
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
        players: [...prev.players, { score: 0, teamId: null, ...player }],
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

  setPlayerTeam: (playerId, teamId) =>
    set((prev) => ({
      players: prev.players.map((p) =>
        p.id === playerId ? { ...p, teamId } : p
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

  setGameMode: (gameMode) => set({ gameMode }),

  setTeams: (teams) => set({ teams }),

  setCorrectPlayers: (correctPlayers) => set({ correctPlayers }),

  setCorrectTeams: (correctTeams) => set({ correctTeams }),

  addCorrectAnswer: (playerId, teamId) =>
    set((prev) => ({
      correctPlayers: prev.correctPlayers.includes(playerId)
        ? prev.correctPlayers
        : [...prev.correctPlayers, playerId],
      correctTeams:
        teamId && !prev.correctTeams.includes(teamId)
          ? [...prev.correctTeams, teamId]
          : prev.correctTeams,
    })),

  clearCorrectAnswers: () => set({ correctPlayers: [], correctTeams: [] }),

  setMasterId: (masterId) => set({ masterId }),

  setPlayerName: (playerName) => set({ playerName }),

  resetGame: () => set(initialState),
}));
