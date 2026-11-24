import { Injectable } from '@nestjs/common';
import { GameSessionManager } from './game-session.manager';
import { Server, Socket } from 'socket.io';
import { GameSession } from './game-session';
import { GameState } from './game-state';
import { ServerEvents, GameMode, Team, Player } from '@blindtest/shared';
import { MusicService, MusicTrack } from './music.service';
import { resolveClientId } from './client-id';

export function calculateAudioStartTime(
  duration?: number,
  startTimes?: number[],
): number {
  if (Array.isArray(startTimes) && startTimes.length > 0) {
    const randomIndex = Math.floor(Math.random() * startTimes.length);
    const chosenTime = startTimes[randomIndex];
    if (
      typeof chosenTime === 'number' &&
      !isNaN(chosenTime) &&
      chosenTime >= 0
    ) {
      return chosenTime;
    }
  }

  const minStartTime = 13;
  const musicDuration =
    typeof duration === 'number' && duration > 0 ? duration : 180;
  const maxStartTime = Math.max(minStartTime, Math.floor(musicDuration - 40));

  return (
    Math.floor(Math.random() * (maxStartTime - minStartTime + 1)) + minStartTime
  );
}

@Injectable()
export class GameService {
  server: Server;

  constructor(
    private gameSessionManager: GameSessionManager,
    private musicService: MusicService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  createGame(masterId: string) {
    return this.gameSessionManager.createGame(masterId);
  }

  getGame(code: string) {
    return this.gameSessionManager.getGame(code);
  }

  /**
   * La configuration du salon (reglages, equipes) est modifiable dans le lobby
   * et une fois la partie terminee, avant de relancer une nouvelle partie.
   */
  canEditRoom(game: GameSession): boolean {
    return game.state === GameState.LOBBY || game.state === GameState.FINISHED;
  }

  updateRoomSettings(
    code: string,
    settings: {
      totalRounds?: number;
      gameMode?: GameMode;
      teams?: Team[];
      artistBonusEnabled?: boolean;
    },
    clientId: string,
  ) {
    const game = this.gameSessionManager.getGame(code);
    if (!game) {
      return null;
    }
    if (game.masterId !== clientId) {
      return null;
    }
    if (!this.canEditRoom(game)) {
      return null;
    }

    if (typeof settings.totalRounds === 'number') {
      game.setTotalRounds(settings.totalRounds);
    }
    if (settings.gameMode) {
      game.setGameMode(settings.gameMode);
    }
    if (settings.teams) {
      game.setTeams(settings.teams);
    }
    if (typeof settings.artistBonusEnabled === 'boolean') {
      game.setArtistBonusEnabled(settings.artistBonusEnabled);
    }

    return game;
  }

  selectTeam(code: string, playerId: string, teamId: string | null): Player | null {
    const game = this.gameSessionManager.getGame(code);
    if (!game || !this.canEditRoom(game)) {
      return null;
    }
    const success = game.assignPlayerToTeam(playerId, teamId);
    if (success) {
      return game.players.find((p) => p.id === playerId) || null;
    }
    return null;
  }

  startGame(code: string) {
    const game = this.gameSessionManager.getGame(code);

    if (game != undefined) {
      this.gameLoop(game);
    }
  }

  verifyAnswer(code: string, answer: string, client: Socket) {
    const game = this.gameSessionManager.getGame(code);

    if (game?.state !== GameState.PLAYING) {
      return;
    }

    const currentTrack = game.getCurrentTrack();
    if (!currentTrack) {
      return;
    }

    const cleanAnswer = this.normalizeString(answer);
    if (!cleanAnswer) {
      return;
    }

    const cleanTitle = this.normalizeString(currentTrack.title);
    const cleanAuthor = currentTrack.author
      ? this.normalizeString(currentTrack.author)
      : currentTrack.artist
      ? this.normalizeString(currentTrack.artist)
      : '';

    // 1. Réponse principale (Titre, ou Auteur si le bonus n'est pas activé)
    const playerId = resolveClientId(client);

    if (game.canPlayerAnswer(playerId)) {
      const isTitleMatch =
        cleanTitle.length > 0 && cleanAnswer.includes(cleanTitle);
      const isAuthorMatch =
        cleanAuthor.length > 0 && cleanAnswer.includes(cleanAuthor);

      const isMainMatch = game.artistBonusEnabled
        ? isTitleMatch
        : isTitleMatch || isAuthorMatch;

      if (isMainMatch) {
        this.handleGoodAnswer(client, game, playerId);
        return;
      }
    }

    // 2. Réponse bonus artiste (si activé et joueur/équipe éligible)
    if (game.canPlayerAnswerBonus(playerId)) {
      const isBonusMatch =
        cleanAuthor.length > 0 && cleanAnswer.includes(cleanAuthor);

      if (isBonusMatch) {
        this.handleGoodBonusAnswer(client, game, playerId);
        return;
      }
    }
  }

  private normalizeString(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private handleGoodAnswer(client: Socket, game: GameSession, playerId: string) {
    const player = game.players.find(p => p.id === playerId);

    const roundTime = 30;
    const elapsedTime = Math.max(
      1,
      Math.floor(Date.now() / 1000) - game.roundStartTime,
    );

    let calculatedScore: number;

    if (elapsedTime <= 5) {
      calculatedScore = 100;
    } else {
      calculatedScore = Math.ceil(100 - 50 * (elapsedTime / (roundTime - 5)));
    }

    console.log(`player : ${player?.name} earned: ${calculatedScore}`);

    const newScore = (player?.score ?? 0) + calculatedScore;
    if (player != null) {
      player.score = newScore;
    }

    game.recordCorrectAnswer(playerId);

    const teamScores = game.getTeamScores();
    const correctPlayers = Array.from(game.correctPlayersForCurrentRound);
    const correctTeams = Array.from(game.correctTeamsForCurrentRound);
    const bonusPlayers = Array.from(game.bonusPlayersForCurrentRound);
    const bonusTeams = Array.from(game.bonusTeamsForCurrentRound);

    client.emit(ServerEvents.VALID_ANSWER, {
      newScore,
      teamScores,
      teamId: player?.teamId,
      correctPlayers,
      correctTeams,
      bonusPlayers,
      bonusTeams,
      artistBonusEnabled: game.artistBonusEnabled,
    });

    const room = `game:${game.code}`;
    this.server?.to(room).emit(ServerEvents.SCORE_UPDATED, {
      playerId: player?.id,
      newScore,
      players: game.players,
      teamScores,
      correctPlayers,
      correctTeams,
      bonusPlayers,
      bonusTeams,
    });

    if (game.haveAllPlayersAnswered()) {
      game.endRoundEarly();
    }
  }

  private handleGoodBonusAnswer(client: Socket, game: GameSession, playerId: string) {
    const player = game.players.find((p) => p.id === playerId);
    const bonusPoints = 50;

    console.log(`player : ${player?.name} earned artist bonus: ${bonusPoints}`);

    const newScore = (player?.score ?? 0) + bonusPoints;
    if (player != null) {
      player.score = newScore;
    }

    game.recordCorrectBonusAnswer(playerId);

    const teamScores = game.getTeamScores();
    const correctPlayers = Array.from(game.correctPlayersForCurrentRound);
    const correctTeams = Array.from(game.correctTeamsForCurrentRound);
    const bonusPlayers = Array.from(game.bonusPlayersForCurrentRound);
    const bonusTeams = Array.from(game.bonusTeamsForCurrentRound);

    client.emit(ServerEvents.BONUS_VALID_ANSWER, {
      newScore,
      bonusPoints,
      teamScores,
      teamId: player?.teamId,
      correctPlayers,
      correctTeams,
      bonusPlayers,
      bonusTeams,
      artistBonusEnabled: game.artistBonusEnabled,
    });

    const room = `game:${game.code}`;
    this.server?.to(room).emit(ServerEvents.SCORE_UPDATED, {
      playerId: player?.id,
      newScore,
      players: game.players,
      teamScores,
      correctPlayers,
      correctTeams,
      bonusPlayers,
      bonusTeams,
    });

    if (game.haveAllPlayersAnswered()) {
      game.endRoundEarly();
    }
  }

  shuffleTracks(tracks: MusicTrack[]): MusicTrack[] {
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getTrackIdentifier(track: MusicTrack): string {
    return (
      track.filename ||
      track.id ||
      track.title ||
      (track as any).name ||
      track.url ||
      ''
    );
  }

  selectTracksForGame(
    availableTracks: MusicTrack[],
    totalRounds: number,
    game: GameSession,
  ): MusicTrack[] {
    if (!availableTracks || availableTracks.length === 0) {
      return game.tracks.length > 0 ? game.tracks : [];
    }

    const unplayedTracks = availableTracks.filter(
      (track) => !game.hasTrackBeenPlayed(this.getTrackIdentifier(track)),
    );

    let selectedTracks: MusicTrack[] = [];

    if (unplayedTracks.length >= totalRounds) {
      const shuffledUnplayed = this.shuffleTracks(unplayedTracks);
      selectedTracks = shuffledUnplayed.slice(0, totalRounds);
      for (const track of selectedTracks) {
        game.markTrackAsPlayed(this.getTrackIdentifier(track));
      }
    } else if (unplayedTracks.length > 0) {
      const shuffledUnplayed = this.shuffleTracks(unplayedTracks);
      const alreadyPlayedTracks = availableTracks.filter((track) =>
        game.hasTrackBeenPlayed(this.getTrackIdentifier(track)),
      );
      const shuffledPlayed = this.shuffleTracks(alreadyPlayedTracks);
      const needed = totalRounds - shuffledUnplayed.length;
      const additionalTracks = shuffledPlayed.slice(0, needed);

      selectedTracks = this.shuffleTracks([
        ...shuffledUnplayed,
        ...additionalTracks,
      ]);

      game.resetPlayedTracks();
      for (const track of selectedTracks) {
        game.markTrackAsPlayed(this.getTrackIdentifier(track));
      }
    } else {
      game.resetPlayedTracks();
      const shuffled = this.shuffleTracks(availableTracks);
      selectedTracks = shuffled.slice(0, totalRounds);
      for (const track of selectedTracks) {
        game.markTrackAsPlayed(this.getTrackIdentifier(track));
      }
    }

    return selectedTracks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async gameLoop(game: GameSession) {
    if (game.state !== GameState.LOBBY && game.state !== GameState.FINISHED) {
      return;
    }

    if (game.state === GameState.FINISHED) {
      game.resetGame();
    }

    // Auto-assigner les joueurs restants si mode équipe
    game.autoAssignTeams();

    const room = `game:${game.code}`;
    const totalRounds = game.totalRounds || 5;
    const availableTracks = this.musicService.getAvailableTracks();
    game.tracks = this.selectTracksForGame(availableTracks, totalRounds, game);

    // 1. Début du compte à rebours avant la partie
    game.state = GameState.COUNTDOWN;
    this.server?.to(room).emit(ServerEvents.GAME_STARTED, {
      code: game.code,
      totalRounds,
      tracks: game.tracks,
      players: game.players,
      gameMode: game.gameMode,
      teams: game.getTeamScores(),
      artistBonusEnabled: game.artistBonusEnabled,
    });

    await this.sleep(3000);

    // 2. Boucle des rounds
    for (let round = 1; round <= totalRounds; round++) {
      game.currentRound = round;
      game.state = GameState.PLAYING;
      game.startRound();
      const track = game.getCurrentTrack();
      const startTime = calculateAudioStartTime(
        track?.duration,
        track?.startTimes,
      );
      game.roundDurationSec = 30;
      game.playbackStartSec = startTime;

      this.server?.to(room).emit(ServerEvents.ROUND_STARTED, {
        currentRound: game.currentRound,
        totalRounds,
        duration: 30,
        track,
        musicUrl: track?.url,
        startTime,
        gameMode: game.gameMode,
        teams: game.getTeamScores(),
        artistBonusEnabled: game.artistBonusEnabled,
        correctPlayers: [],
        correctTeams: [],
        bonusPlayers: [],
        bonusTeams: [],
      });

      // Durée du round pour deviner (fin anticipée si tous les joueurs ont trouvé)
      await game.waitForRoundEnd(30000);

      // Affichage des résultats du round
      game.state = GameState.RESULTS;
      this.server?.to(room).emit(ServerEvents.ROUND_ENDED, {
        currentRound: game.currentRound,
        players: game.players,
        track,
        gameMode: game.gameMode,
        teams: game.getTeamScores(),
        artistBonusEnabled: game.artistBonusEnabled,
        correctPlayers: Array.from(game.correctPlayersForCurrentRound),
        correctTeams: Array.from(game.correctTeamsForCurrentRound),
        bonusPlayers: Array.from(game.bonusPlayersForCurrentRound),
        bonusTeams: Array.from(game.bonusTeamsForCurrentRound),
      });

      await this.sleep(7500);

      // Compte à rebours intermédiaire avant la manche suivante
      if (round < totalRounds) {
        game.state = GameState.COUNTDOWN;
        this.server?.to(room).emit(ServerEvents.ROUND_COUNTDOWN, {
          nextRound: round + 1,
          totalRounds,
        });
        await this.sleep(3000);
      }
    }

    // 3. Fin de la partie
    game.state = GameState.FINISHED;
    this.server?.to(room).emit(ServerEvents.GAME_FINISHED, {
      players: game.players,
      gameMode: game.gameMode,
      teams: game.getTeamScores(),
    });
  }
}
