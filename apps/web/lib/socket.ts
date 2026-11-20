import { Socket } from "socket.io-client";
import {
  ClientEvents,
  GameCreatedPayload,
  GameErrorPayload,
  GameSyncPayload,
  JoinGamePayload,
  Player,
  ResumeGamePayload,
  ServerEvents,
  SocketAck,
  Team,
  GameMode,
} from "@blindtest/shared";

export interface SocketTrack {
  id: string;
  filename: string;
  title: string;
  author?: string;
  artist?: string;
  url: string;
  duration?: number;
  startTimes?: number[];
}

export interface ServerToClientEvents {
  pong: (data: { message: string }) => void;
  [ServerEvents.GAME_CREATED]: (data: GameCreatedPayload) => void;
  [ServerEvents.GAME_SYNC]: (data: GameSyncPayload) => void;
  [ServerEvents.PLAYER_JOINED]: (player: Player) => void;
  [ServerEvents.PLAYER_UPDATED]: (player: Player) => void;
  [ServerEvents.PLAYER_LEFT]: (data: { playerId: string }) => void;
  [ServerEvents.PLAYERS_UPDATED]: (data: { players: Player[] }) => void;
  [ServerEvents.GAME_STARTED]: (data: {
    code: string;
    totalRounds: number;
    tracks?: SocketTrack[];
    players?: Player[];
    gameMode?: GameMode;
    teams?: Team[];
    artistBonusEnabled?: boolean;
  }) => void;
  [ServerEvents.ROUND_STARTED]: (data: {
    currentRound: number;
    totalRounds: number;
    duration: number;
    track?: SocketTrack;
    musicUrl?: string;
    startTime?: number;
    gameMode?: GameMode;
    teams?: Team[];
    artistBonusEnabled?: boolean;
    correctPlayers?: string[];
    correctTeams?: string[];
    bonusPlayers?: string[];
    bonusTeams?: string[];
  }) => void;
  [ServerEvents.ROUND_COUNTDOWN]: (data: { nextRound: number; totalRounds: number }) => void;
  [ServerEvents.ROUND_ENDED]: (data: {
    currentRound: number;
    players: Player[];
    track?: SocketTrack;
    gameMode?: GameMode;
    teams?: Team[];
    artistBonusEnabled?: boolean;
    correctPlayers?: string[];
    correctTeams?: string[];
    bonusPlayers?: string[];
    bonusTeams?: string[];
  }) => void;
  [ServerEvents.SCORE_UPDATED]: (data: {
    playerId?: string;
    newScore?: number;
    players?: Player[];
    teamScores?: Team[];
    correctPlayers?: string[];
    correctTeams?: string[];
    bonusPlayers?: string[];
    bonusTeams?: string[];
  }) => void;
  [ServerEvents.VALID_ANSWER]: (data: {
    newScore: number;
    teamScores?: Team[];
    teamId?: string | null;
    correctPlayers?: string[];
    correctTeams?: string[];
    bonusPlayers?: string[];
    bonusTeams?: string[];
    artistBonusEnabled?: boolean;
  }) => void;
  [ServerEvents.BONUS_VALID_ANSWER]: (data: {
    newScore: number;
    bonusPoints?: number;
    teamScores?: Team[];
    teamId?: string | null;
    correctPlayers?: string[];
    correctTeams?: string[];
    bonusPlayers?: string[];
    bonusTeams?: string[];
    artistBonusEnabled?: boolean;
  }) => void;
  [ServerEvents.GAME_FINISHED]: (data: {
    players: Player[];
    gameMode?: GameMode;
    teams?: Team[];
  }) => void;
  [ServerEvents.ROOM_SETTINGS_UPDATED]: (data: {
    totalRounds?: number;
    gameMode?: GameMode;
    teams?: Team[];
    artistBonusEnabled?: boolean;
  }) => void;
  [ServerEvents.ERROR]: (error: GameErrorPayload) => void;
}

export interface ClientToServerEvents {
  ping: (data: { message: string }) => void;
  [ClientEvents.CREATE_GAME]: (ack?: (response: SocketAck) => void) => void;
  [ClientEvents.JOIN_GAME]: (
    data: JoinGamePayload,
    ack?: (response: SocketAck) => void,
  ) => void;
  [ClientEvents.RESUME_GAME]: (
    data: ResumeGamePayload,
    ack?: (response: SocketAck) => void,
  ) => void;
  [ClientEvents.START_GAME]: (
    data: { gameCode: string },
    ack?: (response: SocketAck) => void,
  ) => void;
  [ClientEvents.ANSWER]: (
    data: { gameCode: string; answer: string },
    ack?: (response: SocketAck) => void,
  ) => void;
  [ClientEvents.UPDATE_SETTINGS]: (data: {
    gameCode: string;
    totalRounds?: number;
    gameMode?: GameMode;
    teams?: Team[];
    artistBonusEnabled?: boolean;
  }) => void;
  [ClientEvents.SELECT_TEAM]: (data: {
    gameCode: string;
    teamId: string | null;
  }) => void;
}

export function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:3001`;
  }
  return "http://localhost:3001";
}

export const getApiUrl = getSocketUrl;

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
