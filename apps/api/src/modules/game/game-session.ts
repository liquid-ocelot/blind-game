import { GameState } from "./game-state";
import { Player } from "./player";

export class GameSession {
  code: string;
  state: GameState;
  players: Player[];
  currentRound: number;
  totalRounds: number;
  masterId: string;
  roundStartTime: number = 0;
  correctPlayersForCurrentRound: Set<string> = new Set();
  private roundTimer?: NodeJS.Timeout;
  private roundResolver?: () => void;

  constructor(
    code: string,
    masterId: string,
    totalRounds: number = 5
  ) {
    this.code = code;
    this.state = GameState.LOBBY;
    this.players = [];
    this.currentRound = 0;
    this.totalRounds = totalRounds;
    this.masterId = masterId;
  }

  startRound() {
    this.roundStartTime = Math.floor(Date.now() / 1000);
    this.correctPlayersForCurrentRound.clear();
  }

  hasPlayerAnsweredCorrectly(playerId: string): boolean {
    return this.correctPlayersForCurrentRound.has(playerId);
  }

  recordCorrectAnswer(playerId: string) {
    this.correctPlayersForCurrentRound.add(playerId);
  }

  haveAllPlayersAnswered(): boolean {
    return (
      this.players.length > 0 &&
      this.players.every((p) => this.correctPlayersForCurrentRound.has(p.id))
    );
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
