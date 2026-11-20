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
  artistBonusEnabled: boolean;
  roundStartTime: number = 0;
  roundDurationSec: number = 30;
  playbackStartSec: number = 0;
  correctPlayersForCurrentRound: Set<string> = new Set();
  correctTeamsForCurrentRound: Set<string> = new Set();
  bonusPlayersForCurrentRound: Set<string> = new Set();
  bonusTeamsForCurrentRound: Set<string> = new Set();
  tracks: MusicTrack[] = [];
  playedTrackIds: Set<string> = new Set();
  private roundTimer?: NodeJS.Timeout;
  private roundResolver?: () => void;

  constructor(
    code: string,
    masterId: string,
    totalRounds: number = 5,
    gameMode: GameMode = GameMode.SOLO,
    teams?: Team[],
    artistBonusEnabled: boolean = false,
  ) {
    this.code = code;
    this.state = GameState.LOBBY;
    this.players = [];
    this.currentRound = 0;
    this.totalRounds = Math.max(5, Math.min(20, Math.round(totalRounds || 5)));
    this.masterId = masterId;
    this.gameMode = gameMode;
    this.teams = teams ? [...teams] : DEFAULT_TEAMS.slice(0, 2).map(t => ({ ...t, score: 0 }));
    this.artistBonusEnabled = artistBonusEnabled;
  }

  setArtistBonusEnabled(enabled: boolean): boolean {
    this.artistBonusEnabled = Boolean(enabled);
    return this.artistBonusEnabled;
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
    this.bonusPlayersForCurrentRound.clear();
    this.bonusTeamsForCurrentRound.clear();
  }

  resetGame() {
    this.currentRound = 0;
    this.roundStartTime = 0;
    this.correctPlayersForCurrentRound.clear();
    this.correctTeamsForCurrentRound.clear();
    this.bonusPlayersForCurrentRound.clear();
    this.bonusTeamsForCurrentRound.clear();
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

  resetPlayedTracks() {
    this.playedTrackIds.clear();
  }

  markTrackAsPlayed(trackId: string) {
    if (trackId) {
      this.playedTrackIds.add(trackId);
    }
  }

  hasTrackBeenPlayed(trackId: string): boolean {
    return this.playedTrackIds.has(trackId);
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

  hasPlayerAnsweredBonus(playerId: string): boolean {
    return this.bonusPlayersForCurrentRound.has(playerId);
  }

  hasTeamAnsweredBonus(teamId: string): boolean {
    return this.bonusTeamsForCurrentRound.has(teamId);
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

  canPlayerAnswerBonus(playerId: string): boolean {
    if (!this.artistBonusEnabled) {
      return false;
    }

    const player = this.players.find((p) => p.id === playerId);
    if (!player) return false;

    // Le joueur ou son équipe doit avoir trouvé la réponse principale
    const hasMainAnswer =
      this.gameMode === GameMode.TEAM && player.teamId
        ? this.hasTeamAnsweredCorrectly(player.teamId)
        : this.hasPlayerAnsweredCorrectly(playerId);

    if (!hasMainAnswer) {
      return false;
    }

    // Le joueur ne doit pas avoir déjà validé le bonus
    if (this.bonusPlayersForCurrentRound.has(playerId)) {
      return false;
    }

    // En mode équipe : 1 seul bonus par équipe
    if (this.gameMode === GameMode.TEAM && player.teamId) {
      if (this.bonusTeamsForCurrentRound.has(player.teamId)) {
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

  recordCorrectBonusAnswer(playerId: string) {
    this.bonusPlayersForCurrentRound.add(playerId);
    const player = this.players.find((p) => p.id === playerId);
    if (player?.teamId) {
      this.bonusTeamsForCurrentRound.add(player.teamId);
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

      if (!allActiveTeamsAnswered || !allUnassignedAnswered) {
        return false;
      }

      if (this.artistBonusEnabled) {
        const allActiveTeamsBonus =
          activeTeamIds.size > 0
            ? Array.from(activeTeamIds).every((teamId) =>
                this.bonusTeamsForCurrentRound.has(teamId)
              )
            : true;
        const allUnassignedBonus =
          unassignedPlayers.length > 0
            ? unassignedPlayers.every((p) =>
                this.bonusPlayersForCurrentRound.has(p.id)
              )
            : true;
        return allActiveTeamsBonus && allUnassignedBonus;
      }

      return true;
    }

    const allMain = this.players.every((p) => this.correctPlayersForCurrentRound.has(p.id));
    if (!allMain) {
      return false;
    }

    if (this.artistBonusEnabled) {
      return this.players.every((p) => this.bonusPlayersForCurrentRound.has(p.id));
    }

    return true;
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
