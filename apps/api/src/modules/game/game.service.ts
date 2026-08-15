import { Injectable } from "@nestjs/common";
import { GameSessionManager } from "./game-session.manager";


@Injectable()
export class GameService {

    constructor(private gameSessionManager: GameSessionManager){}

    createGame(masterId: string) {
       return this.gameSessionManager.createGame(masterId);
    }
}