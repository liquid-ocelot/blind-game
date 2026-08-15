import { Module } from "@nestjs/common";
import { GameGateway } from "./game.gateway";
import { GameService } from "./game.service";
import { GameSessionManager } from "./game-session.manager";



@Module({
    providers: [GameGateway, GameService, GameSessionManager]
})
export class GameModule {}