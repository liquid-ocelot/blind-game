import { GameState } from "./game-state";
import { Player } from "./player";
import { MusicTrack } from "./music.service";
import { GameMode, Team, DEFAULT_TEAMS } from "@blindtest/shared";

export class GameSession {
  code: string;
  state: GameState;
  players: Player[];
  currentRound: number;
  totalRounds: number;
  masterId: string;
  gameMode: GameMode;
  teams: Team[];
  roundStartTime: number = 0;
  correctPlayersForCurrentRound: Set<string> = new Set();
  correctTeamsForCurrentRound: Set<string> = new Set();
  tracks: MusicTrack[] = [];
  private roundTimer?: NodeJS.Timeout;
  private roundResolver?: () => void;

  constructor(
    code: string,
    masterId: string,
    totalRounds: number = 5,
    gameMode: GameMode = GameMode.SOLO,
    teams?: Team[]
  ) {
    this.code = code;
    this.state = GameState.LOBBY;
    this.players = [];
    this.currentRound = 0;
    this.totalRounds = Math.max(5, Math.min(20, Math.round(totalRounds || 5)));
    this.masterId = masterId;
    this.gameMode = gameMode;
    this.teams = teams ? [...teams] : DEFAULT_TEAMS.slice(0, 2).map(t => ({ ...t, score: 0 }));
  }

  setTotalRounds(rounds: number): number {
    this.totalRounds = Math.max(5, Math.min(20, Math.round(rounds || 5)));
    return this.totalRounds;
  }

  setGameMode(mode: GameMode): GameMode {
    if (Object.values(GameMode).includes(mode)) {
      this.gameMode = mode;
    }
    return this.gameMode;
  }

  setTeams(teams: Team[]): Team[] {
    if (Array.isArray(teams) && teams.length >= 2) {
      this.teams = teams.map((team) => ({
        id: team.id,
        name: team.name,
        color: team.color,
        score: team.score ?? 0,
      }));
      // Nettoyer les teamId des joueurs si l'équipe n'existe plus
      const validTeamIds = new Set(this.teams.map((t) => t.id));
      for (const player of this.players) {
        if (player.teamId && !validTeamIds.has(player.teamId)) {
          player.teamId = null;
        }
      }
    }
    return this.teams;
  }

  assignPlayerToTeam(playerId: string, teamId: string | null): boolean {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return false;

    if (teamId === null) {
      player.teamId = null;
      return true;
    }

    const teamExists = this.teams.some((t) => t.id === teamId);
    if (teamExists) {
      player.teamId = teamId;
      return true;
    }

    return false;
  }

  autoAssignTeams() {
    if (this.gameMode !== GameMode.TEAM || this.teams.length === 0) {
      return;
    }

    const unassignedPlayers = this.players.filter((p) => !p.teamId);
    if (unassignedPlayers.length === 0) {
      return;
    }

    for (const player of unassignedPlayers) {
      // Trouver l'équipe avec le moins de joueurs
      const teamCounts = this.teams.map((team) => ({
        teamId: team.id,
        count: this.players.filter((p) => p.teamId === team.id).length,
      }));

      teamCounts.sort((a, b) => a.count - b.count);
      player.teamId = teamCounts[0].teamId;
    }
  }

  getTeamScores(): Team[] {
    return this.teams.map((team) => {
      const teamPlayers = this.players.filter((p) => p.teamId === team.id);
      const totalScore = teamPlayers.reduce((sum, p) => sum + (p.score || 0), 0);
      return {
        ...team,
        score: totalScore,
      };
    });
  }

  startRound() {
    this.roundStartTime = Math.floor(Date.now() / 1000);
    this.correctPlayersForCurrentRound.clear();
    this.correctTeamsForCurrentRound.clear();
  }

  resetGame() {
    this.currentRound = 0;
    this.roundStartTime = 0;
    this.correctPlayersForCurrentRound.clear();
    this.correctTeamsForCurrentRound.clear();
    this.tracks = [];
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = undefined;
    }
    this.roundResolver = undefined;
    for (const player of this.players) {
      player.score = 0;
    }
    for (const team of this.teams) {
      team.score = 0;
    }
  }

  getCurrentTrack(): MusicTrack | undefined {
    if (this.tracks.length === 0 || this.currentRound <= 0) {
      return undefined;
    }
    return this.tracks[(this.currentRound - 1) % this.tracks.length];
  }

  hasPlayerAnsweredCorrectly(playerId: string): boolean {
    return this.correctPlayersForCurrentRound.has(playerId);
  }

  hasTeamAnsweredCorrectly(teamId: string): boolean {
    return this.correctTeamsForCurrentRound.has(teamId);
  }

  canPlayerAnswer(playerId: string): boolean {
    if (this.correctPlayersForCurrentRound.has(playerId)) {
      return false;
    }

    if (this.gameMode === GameMode.TEAM) {
      const player = this.players.find((p) => p.id === playerId);
      if (player?.teamId && this.correctTeamsForCurrentRound.has(player.teamId)) {
        return false;
      }
    }

    return true;
  }

  recordCorrectAnswer(playerId: string) {
    this.correctPlayersForCurrentRound.add(playerId);
    const player = this.players.find((p) => p.id === playerId);
    if (player?.teamId) {
      this.correctTeamsForCurrentRound.add(player.teamId);
    }
  }

  haveAllPlayersAnswered(): boolean {
    if (this.players.length === 0) {
      return false;
    }

    if (this.gameMode === GameMode.TEAM) {
      const activeTeamIds = new Set(
        this.players
          .filter((p) => Boolean(p.teamId))
          .map((p) => p.teamId as string)
      );
      const unassignedPlayers = this.players.filter((p) => !p.teamId);

      if (activeTeamIds.size === 0 && unassignedPlayers.length === 0) {
        return false;
      }

      const allActiveTeamsAnswered =
        activeTeamIds.size > 0
          ? Array.from(activeTeamIds).every((teamId) =>
              this.correctTeamsForCurrentRound.has(teamId)
            )
          : true;

      const allUnassignedAnswered =
        unassignedPlayers.length > 0
          ? unassignedPlayers.every((p) =>
              this.correctPlayersForCurrentRound.has(p.id)
            )
          : true;

      return allActiveTeamsAnswered && allUnassignedAnswered;
    }

    return this.players.every((p) => this.correctPlayersForCurrentRound.has(p.id));
  }

  waitForRoundEnd(durationMs: number = 30000): Promise<void> {
    return new Promise((resolve) => {
      this.roundResolver = resolve;
      this.roundTimer = setTimeout(() => {
        this.roundTimer = undefined;
        this.roundResolver = undefined;
        resolve();
      }, durationMs);
    });
  }

  endRoundEarly() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = undefined;
    }
    if (this.roundResolver) {
      const resolve = this.roundResolver;
      this.roundResolver = undefined;
      resolve();
    }
  }
}
