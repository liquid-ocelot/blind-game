import { Module } from "@nestjs/common";
import { GameGateway } from "./game.gateway";
import { GameService } from "./game.service";
import { GameSessionManager } from "./game-session.manager";
import { MusicService } from "./music.service";
import { MusicController } from "./music.controller";

@Module({
    controllers: [MusicController],
    providers: [GameGateway, GameService, GameSessionManager, MusicService],
    exports: [MusicService],
})
export class GameModule {}
