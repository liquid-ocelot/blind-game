import { Injectable } from '@nestjs/common';
import { GameSessionManager } from './game-session.manager';
import { Server, Socket } from 'socket.io';
import { GameSession } from './game-session';
import { GameState } from './game-state';
import { ServerEvents } from '@blindtest/shared';
import { MusicService, MusicTrack } from './music.service';

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

  updateRoomSettings(
    code: string,
    settings: { totalRounds?: number },
    clientId: string,
  ) {
    const game = this.gameSessionManager.getGame(code);
    if (!game) {
      return null;
    }
    if (game.masterId !== clientId) {
      return null;
    }
    if (game.state !== GameState.LOBBY) {
      return null;
    }

    if (typeof settings.totalRounds === 'number') {
      game.setTotalRounds(settings.totalRounds);
    }

    return game;
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

    if (game.hasPlayerAnsweredCorrectly(client.id)) {
      return;
    }

    const currentTrack = game.getCurrentTrack();
    const cleanAnswer = this.normalizeString(answer);
    const cleanTitle = currentTrack ? this.normalizeString(currentTrack.title) : '';
    const isTrackMatch = currentTrack && cleanAnswer.length > 0 && (
      cleanAnswer.includes(cleanTitle)
    );

    if (isTrackMatch) {
      this.handleGoodAnswer(client, game);
    }
  }

  private normalizeString(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private handleGoodAnswer(client: Socket, game: GameSession) {
    const player = game.players.find(p => p.id === client.id);

    const roundTime = 30;
    const elapsedTime = Math.max(
      1,
      Math.floor(Date.now() / 1000) - game.roundStartTime,
    );
    const calculatedScore = Math.ceil(100 - 50 * (elapsedTime / roundTime));

    console.log(`player : ${player?.name} earned: ${calculatedScore}`);

    const newScore = (player?.score ?? 0) + calculatedScore;
    if (player != null) {
      player.score = newScore;
    }

    game.recordCorrectAnswer(client.id);

    client.emit(ServerEvents.VALID_ANSWER, { newScore });

    if (game.haveAllPlayersAnswered()) {
      game.endRoundEarly();
    }
  }

  private shuffleTracks(tracks: MusicTrack[]): MusicTrack[] {
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
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

    const room = `game:${game.code}`;
    const totalRounds = game.totalRounds || 5;
    const availableTracks = this.musicService.getAvailableTracks();
    game.tracks = this.shuffleTracks(availableTracks);

    // 1. Début du compte à rebours avant la partie
    game.state = GameState.COUNTDOWN;
    this.server?.to(room).emit(ServerEvents.GAME_STARTED, {
      code: game.code,
      totalRounds,
      tracks: game.tracks,
      players: game.players,
    });

    await this.sleep(3000);

    // 2. Boucle des rounds
    for (let round = 1; round <= totalRounds; round++) {
      // if (game.state === GameState.FINISHED) {
      //   break;
      // }

      game.currentRound = round;
      game.state = GameState.PLAYING;
      const track = game.getCurrentTrack();
      const startTime = Math.floor(Math.random() * 21) + 10;

      this.server?.to(room).emit(ServerEvents.ROUND_STARTED, {
        currentRound: game.currentRound,
        totalRounds,
        duration: 30,
        track,
        musicUrl: track?.url,
        startTime,
      });

      game.startRound();

      // Durée du round pour deviner (fin anticipée si tous les joueurs ont trouvé)
      await game.waitForRoundEnd(30000);

      // Affichage des résultats du round
      game.state = GameState.RESULTS;
      this.server?.to(room).emit(ServerEvents.ROUND_ENDED, {
        currentRound: game.currentRound,
        players: game.players,
        track,
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
    });
  }
}
