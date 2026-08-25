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
  }
}
