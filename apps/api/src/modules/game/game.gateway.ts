import { ClientEvents, ServerEvents } from "@blindtest/shared";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { GameService } from "./game.service";
import { GameSessionManager } from "./game-session.manager";

@WebSocketGateway({
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? (process.env.WEB_ORIGIN?.split(',') ?? [])
        : true,
  },
})
export class GameGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private gameService: GameService,
    private gameSessionManager: GameSessionManager,
  ) {}

  afterInit(server: Server) {
    this.gameService.setServer(server);
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() data: { message: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('Ping reçu :', data);

    client.emit('pong', { message: 'Hello JS' });
  }

  @SubscribeMessage(ClientEvents.JOIN_GAME)
  handleJoinGame(
    @MessageBody()
    data: {
      gameCode: string;
      playerName: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`game:${data.gameCode}`);

    const player = {
      id: client.id,
      name: data.playerName,
      score: 0,
    };

    this.gameSessionManager.addPlayer(data.gameCode, player);

    this.server
      .to(`game:${data.gameCode}`)
      .emit(ServerEvents.PLAYER_JOINED, player);

    const game = this.gameSessionManager.getGame(data.gameCode);
    if (game) {
      client.emit(ServerEvents.ROOM_SETTINGS_UPDATED, {
        totalRounds: game.totalRounds,
      });
    }
  }

  @SubscribeMessage(ClientEvents.CREATE_GAME)
  handleCreateGame(@ConnectedSocket() client: Socket) {
    const code = this.gameService.createGame(client.id);
    client.join(`game:${code}`);

    const game = this.gameSessionManager.getGame(code);
    client.emit(ServerEvents.GAME_CREATED, {
      code,
      totalRounds: game?.totalRounds ?? 5,
    });
  }

  @SubscribeMessage(ClientEvents.UPDATE_SETTINGS)
  handleUpdateSettings(
    @MessageBody() data: { gameCode: string; totalRounds: number },
    @ConnectedSocket() client: Socket,
  ) {
    const code = data?.gameCode;
    if (!code) return;

    const game = this.gameService.updateRoomSettings(
      code,
      { totalRounds: data.totalRounds },
      client.id,
    );

    if (game) {
      this.server
        .to(`game:${code}`)
        .emit(ServerEvents.ROOM_SETTINGS_UPDATED, {
          totalRounds: game.totalRounds,
        });
    }
  }

  @SubscribeMessage(ClientEvents.START_GAME)
  handleStartGame(
    @MessageBody() data: { gameCode: string },
  ) {
    const code = data?.gameCode;
    if (code) {
      this.gameService.startGame(code);
    }
  }

  @SubscribeMessage(ClientEvents.ANSWER)
  handleAnswer(
    @MessageBody() data: { gameCode: string; answer: string },
    @ConnectedSocket() client: Socket,
  ) {
    const code = data?.gameCode;
    console.log(`received answer ${data.answer} for room ${data.gameCode}`)
    if (code) {
      this.gameService.verifyAnswer(code, data.answer, client);
    }
  }
}
