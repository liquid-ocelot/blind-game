import { Injectable } from '@nestjs/common';
import { GameSessionManager } from './game-session.manager';
import { Server, Socket } from 'socket.io';
import { GameSession } from './game-session';
import { GameState } from './game-state';
import { ServerEvents } from '@blindtest/shared';
import { MusicService } from './music.service';

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

    const tracks = this.musicService.getAvailableTracks();
    const currentTrack =
      tracks.length > 0
        ? tracks[(game.currentRound - 1) % tracks.length]
        : undefined;
    const cleanAnswer = answer.toLowerCase().trim();
    const isTrackMatch = currentTrack && cleanAnswer.length > 0 && (
      currentTrack.title.toLowerCase().includes(cleanAnswer) ||
      cleanAnswer.includes(currentTrack.title.toLowerCase())
    );

    if (isTrackMatch) {
      this.handleGoodAnswer(client, game);
    }
  }

  private handleGoodAnswer(client: Socket, game: GameSession) {
    const player = game.players.find(p => p.id === client.id);

    const roundTime = 30;
    const elapsedTime = Math.max(
      1,
      Math.floor(Date.now() / 1000) - game.roundStartTime,
    );
    const calculatedScore = Math.ceil(100 - 100 * (elapsedTime / roundTime));

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async gameLoop(game: GameSession) {
    if (game.state !== GameState.LOBBY) {
      return;
    }

    const room = `game:${game.code}`;
    const totalRounds = game.totalRounds || 5;
    const tracks = this.musicService.getAvailableTracks();

    // 1. Début du compte à rebours avant la partie
    game.state = GameState.COUNTDOWN;
    this.server?.to(room).emit(ServerEvents.GAME_STARTED, {
      code: game.code,
      totalRounds,
      tracks,
    });

    await this.sleep(3000);

    // 2. Boucle des rounds
    for (let round = 1; round <= totalRounds; round++) {
      // if (game.state === GameState.FINISHED) {
      //   break;
      // }

      game.currentRound = round;
      game.state = GameState.PLAYING;
      const track = tracks.length > 0 ? tracks[(round - 1) % tracks.length] : undefined;

      this.server?.to(room).emit(ServerEvents.ROUND_STARTED, {
        currentRound: game.currentRound,
        totalRounds,
        duration: 30,
        track,
        musicUrl: track?.url,
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

      await this.sleep(4000);
    }

    // 3. Fin de la partie
    game.state = GameState.FINISHED;
    this.server?.to(room).emit('game:finished', {
      players: game.players,
    });
  }
}
