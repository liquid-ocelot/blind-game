import { Injectable } from "@nestjs/common";
import { GameSession } from "./game-session";
import { Player } from "./player";

@Injectable()
export class GameSessionManager {



    private games = new Map<string, GameSession>();

    createGame(masterId: string): string {
        const code = this.generateCode();
        const session = new GameSession(code, masterId);
        this.games.set(code, session);
        console.log('Sessions created: ', code);
        return code;
    }

    getGame(code: string) {
        return this.games.get(code);
    }

    addPlayer(code: string, player: Player) {
        // ...
    }

    removePlayer(code: string, playerId: string) {
        // ...
    }


    private generateCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return Array.from(
            { length: 4 },
            () => chars[Math.floor(Math.random() * chars.length)]
        ).join('');
    }
}