import { Injectable } from '@nestjs/common';
import { GameSessionManager } from './game-session.manager';
import { Server } from 'socket.io';
import { GameSession } from './game-session';
import { GameState } from './game-state';
import { ServerEvents } from '@blindtest/shared';

@Injectable()
export class GameService {
  server: Server;

  constructor(private gameSessionManager: GameSessionManager) {}

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async gameLoop(game: GameSession) {
    if (game.state !== GameState.LOBBY) {
      return;
    }

    const room = `game:${game.code}`;
    const totalRounds = game.totalRounds || 5;

    // 1. Début du compte à rebours avant la partie
    game.state = GameState.COUNTDOWN;
    this.server?.to(room).emit(ServerEvents.GAME_STARTED, {
      code: game.code,
      totalRounds,
    });

    await this.sleep(3000);

    // 2. Boucle des rounds
    for (let round = 1; round <= totalRounds; round++) {
      // if (game.state === GameState.FINISHED) {
      //   break;
      // }

      game.currentRound = round;
      game.state = GameState.PLAYING;

      this.server?.to(room).emit(ServerEvents.ROUND_STARTED, {
        currentRound: game.currentRound,
        totalRounds,
        duration: 10,
      });

      // Durée du round pour deviner
      await this.sleep(10000);

      // Affichage des résultats du round
      game.state = GameState.RESULTS;
      this.server?.to(room).emit(ServerEvents.ROUND_ENDED, {
        currentRound: game.currentRound,
        players: game.players,
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
