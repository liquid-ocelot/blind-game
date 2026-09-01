import { ClientEvents, ServerEvents, GameMode, Team, Player } from "@blindtest/shared";
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
      teamId?: string | null;
    },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`game:${data.gameCode}`);

    const player: Player = {
      id: client.id,
      name: data.playerName,
      score: 0,
      teamId: data.teamId ?? null,
    };

    this.gameSessionManager.addPlayer(data.gameCode, player);

    this.server
      .to(`game:${data.gameCode}`)
      .emit(ServerEvents.PLAYER_JOINED, player);

    const game = this.gameSessionManager.getGame(data.gameCode);
    if (game) {
      client.emit(ServerEvents.ROOM_SETTINGS_UPDATED, {
        totalRounds: game.totalRounds,
        gameMode: game.gameMode,
        teams: game.teams,
        artistBonusEnabled: game.artistBonusEnabled,
      });
      // Envoyer la liste de tous les joueurs actuels au joueur qui vient d'arriver
      client.emit(ServerEvents.PLAYERS_UPDATED, {
        players: game.players,
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
      gameMode: game?.gameMode ?? GameMode.SOLO,
      teams: game?.teams ?? [],
      artistBonusEnabled: game?.artistBonusEnabled ?? false,
    });
  }

  @SubscribeMessage(ClientEvents.UPDATE_SETTINGS)
  handleUpdateSettings(
    @MessageBody()
    data: {
      gameCode: string;
      totalRounds?: number;
      gameMode?: GameMode;
      teams?: Team[];
      artistBonusEnabled?: boolean;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const code = data?.gameCode;
    if (!code) return;

    const game = this.gameService.updateRoomSettings(
      code,
      {
        totalRounds: data.totalRounds,
        gameMode: data.gameMode,
        teams: data.teams,
        artistBonusEnabled: data.artistBonusEnabled,
      },
      client.id,
    );

    if (game) {
      this.server
        .to(`game:${code}`)
        .emit(ServerEvents.ROOM_SETTINGS_UPDATED, {
          totalRounds: game.totalRounds,
          gameMode: game.gameMode,
          teams: game.teams,
          artistBonusEnabled: game.artistBonusEnabled,
        });

      this.server
        .to(`game:${code}`)
        .emit(ServerEvents.PLAYERS_UPDATED, {
          players: game.players,
        });
    }
  }

  @SubscribeMessage(ClientEvents.SELECT_TEAM)
  handleSelectTeam(
    @MessageBody()
    data: {
      gameCode: string;
      teamId: string | null;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const code = data?.gameCode;
    if (!code) return;

    const updatedPlayer = this.gameService.selectTeam(code, client.id, data.teamId);
    if (updatedPlayer) {
      const game = this.gameSessionManager.getGame(code);
      this.server
        .to(`game:${code}`)
        .emit(ServerEvents.PLAYER_UPDATED, updatedPlayer);

      if (game) {
        this.server
          .to(`game:${code}`)
          .emit(ServerEvents.PLAYERS_UPDATED, {
            players: game.players,
          });
      }
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
