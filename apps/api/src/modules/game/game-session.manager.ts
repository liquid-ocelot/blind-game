import { Injectable } from "@nestjs/common";
import { GameSession } from "./game-session";
import { GameState } from "./game-state";
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
        const game = this.getGame(code);
        if (game) {
            const existing = game.players.find((p) => p.id === player.id);
            if (existing) {
                existing.name = player.name;
                if (player.teamId !== undefined) {
                    existing.teamId = player.teamId;
                }
            } else {
                game.players.push({
                    ...player,
                    score: player.score ?? 0,
                    teamId: player.teamId ?? null,
                });
            }
        }
    }

    removePlayer(code: string, playerId: string) {
        const game = this.getGame(code);
        if (game) {
            game.players = game.players.filter((p) => p.id !== playerId);
            if (game.state === GameState.PLAYING && game.haveAllPlayersAnswered()) {
                game.endRoundEarly();
            }
        }
    }


    private generateCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return Array.from(
            { length: 4 },
            () => chars[Math.floor(Math.random() * chars.length)]
        ).join('');
    }
}
