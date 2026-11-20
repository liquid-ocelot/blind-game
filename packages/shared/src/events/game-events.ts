
import type { GameMode, Player, Team } from '../types/game.js';

export const ClientEvents = {
  CREATE_GAME: 'game:create',
  JOIN_GAME: 'game:join',
  RESUME_GAME: 'game:resume',
  START_GAME: 'game:start',
  ANSWER: 'game:answer',
  UPDATE_SETTINGS: 'game:update-settings',
  SELECT_TEAM: 'game:select-team',
} as const;

export const ServerEvents = {
  GAME_CREATED: 'game:created',
  GAME_SYNC: 'game:sync',
  PLAYER_JOINED: 'game:player-joined',
  PLAYER_UPDATED: 'game:player-updated',
  PLAYER_LEFT: 'game:player-left',
  PLAYERS_UPDATED: 'game:players-updated',
  GAME_STARTED: 'game:started',
  ROUND_STARTED: 'round:started',
  ROUND_COUNTDOWN: 'round:countdown',
  ROUND_ENDED: 'round:ended',
  SCORE_UPDATED: 'game:score-updated',
  VALID_ANSWER: 'game:valid-answer',
  BONUS_VALID_ANSWER: 'game:bonus-valid-answer',
  INVALID_ANSWER: 'game:invalid-answer',
  GAME_FINISHED: 'game:finished',
  ROOM_SETTINGS_UPDATED: 'room:settings-updated',
  ERROR: 'game:error',
} as const;

export type GameErrorCode =
  | 'CONNECTION'
  | 'GAME_NOT_FOUND'
  | 'NOT_HOST'
  | 'NOT_IN_GAME'
  | 'INVALID_PAYLOAD'
  | 'GAME_ALREADY_STARTED';

export interface GameErrorPayload {
  code: GameErrorCode;
  message: string;
  event?: string;
}

export interface SocketAck {
  ok: boolean;
  error?: GameErrorPayload;
}

export interface JoinGamePayload {
  gameCode: string;
  playerName: string;
  teamId?: string | null;
}

export interface ResumeGamePayload {
  gameCode: string;
  role: 'host' | 'player';
  playerName?: string;
}

export interface GameCreatedPayload {
  code: string;
  totalRounds: number;
  gameMode: GameMode;
  teams: Team[];
  artistBonusEnabled: boolean;
}

export interface SyncTrack {
  id?: string;
  filename?: string;
  title?: string;
  author?: string;
  artist?: string;
  url?: string;
  duration?: number;
  startTimes?: number[];
}

export type SyncGameState =
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'RESULTS'
  | 'FINISHED';

export interface GameSyncPayload {
  code: string;
  masterId: string;
  state: SyncGameState;
  players: Player[];
  currentRound: number;
  totalRounds: number;
  gameMode: GameMode;
  teams: Team[];
  artistBonusEnabled: boolean;
  correctPlayers: string[];
  correctTeams: string[];
  bonusPlayers: string[];
  bonusTeams: string[];
  playerName?: string;
  secondsLeft: number | null;
  track?: SyncTrack | null;
  audioOffset?: number | null;
}
