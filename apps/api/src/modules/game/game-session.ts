import { GameState } from "./game-state";


interface GameSession {
  code: string;
  state: GameState;
  //players: Player[];
  currentRound: number;
}