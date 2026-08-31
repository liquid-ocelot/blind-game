export enum GameMode {
  SOLO = 'SOLO',
  TEAM = 'TEAM',
}

export interface Team {
  id: string;
  name: string;
  color: string;
  score?: number;
}

export interface Player {
  id: string;
  name: string;
  score?: number;
  teamId?: string | null;
  isHost?: boolean;
}

export interface RoomSettings {
  totalRounds: number;
  gameMode: GameMode;
  teams?: Team[];
}

export const DEFAULT_TEAMS: Team[] = [
  { id: 'team-red', name: 'Équipe Rouge', color: '#EF4444' },
  { id: 'team-blue', name: 'Équipe Bleue', color: '#3B82F6' },
  { id: 'team-green', name: 'Équipe Verte', color: '#10B981' },
  { id: 'team-yellow', name: 'Équipe Jaune', color: '#F59E0B' },
];
