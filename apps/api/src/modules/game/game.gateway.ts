import {
  ClientEvents,
  ServerEvents,
  GameMode,
  Team,
  Player,
} from "@blindtest/shared";
import type {
  GameErrorPayload,
  GameSyncPayload,
  JoinGamePayload,
  ResumeGamePayload,
  SocketAck,
  SyncTrack,
} from "@blindtest/shared";
import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { GameService } from "./game.service";
import { GameSessionManager } from "./game-session.manager";
import { ConnectionRegistry } from "./connection-registry";
import { resolveClientId } from "./client-id";
import { GameState } from "./game-state";
import { GameSession } from "./game-session";

const DISCONNECT_GRACE_MS = 15_000;

@WebSocketGateway({
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? (process.env.WEB_ORIGIN?.split(",") ?? [])
        : true,
  },
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private gameService: GameService,
    private gameSessionManager: GameSessionManager,
    private registry: ConnectionRegistry,
  ) {}

  afterInit(server: Server) {
    this.gameService.setServer(server);
  }

  handleConnection(client: Socket) {
    const clientId = resolveClientId(client);
    this.registry.cancelDisconnect(clientId);
    const membership = this.registry.get(clientId);
    if (membership) {
      client.join(this.room(membership.gameCode));
    }
    this.logger.log(`connected ${clientId}`);
  }

  handleDisconnect(client: Socket) {
    const clientId = resolveClientId(client);
    const membership = this.registry.get(clientId);
    if (!membership || membership.role !== "player") {
      this.logger.log(`disconnected ${clientId}`);
      return;
    }

    this.registry.scheduleDisconnect(clientId, () => {
      this.gameSessionManager.removePlayer(membership.gameCode, clientId);
      this.registry.forget(clientId);
      this.server.to(this.room(membership.gameCode)).emit(ServerEvents.PLAYER_LEFT, {
        playerId: clientId,
      });
      this.emitPlayers(membership.gameCode);
      this.logger.log(`removed ${clientId} from ${membership.gameCode}`);
    }, DISCONNECT_GRACE_MS);
    this.logger.log(`disconnected ${clientId}, grace ${DISCONNECT_GRACE_MS}ms`);
  }

  @SubscribeMessage("ping")
  handlePing(
    @MessageBody() data: { message: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.emit("pong", { message: data?.message ?? "pong" });
  }

  @SubscribeMessage(ClientEvents.JOIN_GAME)
  handleJoinGame(
    @MessageBody() data: JoinGamePayload,
    @ConnectedSocket() client: Socket,
  ): SocketAck {
    const clientId = resolveClientId(client);
    const code = data?.gameCode?.trim().toUpperCase();
    const playerName = data?.playerName?.trim();
    if (!code || !playerName) {
      return this.fail(client, "INVALID_PAYLOAD", "Nom ou code manquant.", ClientEvents.JOIN_GAME);
    }

    const game = this.gameSessionManager.getGame(code);
    if (!game) {
      return this.fail(client, "GAME_NOT_FOUND", "Ce salon n'existe plus.", ClientEvents.JOIN_GAME);
    }

    this.detach(client, clientId, code);
    client.join(this.room(code));

    const player: Player = {
      id: clientId,
      name: playerName,
      score: 0,
      ...(data.teamId !== undefined ? { teamId: data.teamId } : {}),
    };
    const alreadyThere = game.players.some((existing) => existing.id === clientId);
    this.gameSessionManager.addPlayer(code, player);
    this.registry.remember({
      clientId,
      gameCode: code,
      role: "player",
      playerName,
    });

    const joined = game.players.find((existing) => existing.id === clientId) ?? player;
    if (!alreadyThere) {
      this.server.to(this.room(code)).emit(ServerEvents.PLAYER_JOINED, joined);
    }
    this.emitPlayers(code);
    client.emit(ServerEvents.ROOM_SETTINGS_UPDATED, this.settingsOf(game));
    client.emit(ServerEvents.GAME_SYNC, this.buildSync(game, clientId));
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.RESUME_GAME)
  handleResumeGame(
    @MessageBody() data: ResumeGamePayload,
    @ConnectedSocket() client: Socket,
  ): SocketAck {
    const clientId = resolveClientId(client);
    const code = data?.gameCode?.trim().toUpperCase();
    if (!code || (data.role !== "host" && data.role !== "player")) {
      return this.fail(client, "INVALID_PAYLOAD", "Reprise de session impossible.", ClientEvents.RESUME_GAME);
    }

    const game = this.gameSessionManager.getGame(code);
    if (!game) {
      return this.fail(client, "GAME_NOT_FOUND", "Ce salon n'existe plus.", ClientEvents.RESUME_GAME);
    }

    if (data.role === "host") {
      if (game.masterId !== clientId) {
        return this.fail(client, "NOT_HOST", "Seul l'hôte peut reprendre ce salon.", ClientEvents.RESUME_GAME);
      }
      this.detach(client, clientId, code);
      client.join(this.room(code));
      this.registry.remember({ clientId, gameCode: code, role: "host" });
      client.emit(ServerEvents.GAME_SYNC, this.buildSync(game, clientId));
      return { ok: true };
    }

    const playerName = data.playerName?.trim();
    let player = game.players.find((existing) => existing.id === clientId);
    if (!player && !playerName) {
      return this.fail(client, "INVALID_PAYLOAD", "Nom manquant pour reprendre la partie.", ClientEvents.RESUME_GAME);
    }

    this.detach(client, clientId, code);
    client.join(this.room(code));
    if (!player) {
      player = {
        id: clientId,
        name: playerName!,
        score: 0,
        teamId: null,
      };
      this.gameSessionManager.addPlayer(code, player);
      this.server.to(this.room(code)).emit(ServerEvents.PLAYER_JOINED, player);
    }

    this.registry.remember({
      clientId,
      gameCode: code,
      role: "player",
      playerName: player.name,
    });
    this.emitPlayers(code);
    client.emit(ServerEvents.GAME_SYNC, this.buildSync(game, clientId));
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.CREATE_GAME)
  handleCreateGame(@ConnectedSocket() client: Socket): SocketAck {
    const clientId = resolveClientId(client);
    this.detach(client, clientId);
    const code = this.gameService.createGame(clientId);
    client.join(this.room(code));
    this.registry.remember({ clientId, gameCode: code, role: "host" });

    const game = this.gameSessionManager.getGame(code);
    client.emit(ServerEvents.GAME_CREATED, {
      code,
      totalRounds: game?.totalRounds ?? 5,
      gameMode: game?.gameMode ?? GameMode.SOLO,
      teams: game?.teams ?? [],
      artistBonusEnabled: game?.artistBonusEnabled ?? false,
    });
    return { ok: true };
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
  ): SocketAck {
    const clientId = resolveClientId(client);
    const code = data?.gameCode?.trim().toUpperCase();
    const game = code ? this.gameSessionManager.getGame(code) : undefined;
    if (!game) {
      return this.fail(client, "GAME_NOT_FOUND", "Ce salon n'existe plus.", ClientEvents.UPDATE_SETTINGS);
    }
    if (game.masterId !== clientId) {
      return this.fail(client, "NOT_HOST", "Seul l'hôte peut modifier le salon.", ClientEvents.UPDATE_SETTINGS);
    }
    if (!this.gameService.canEditRoom(game)) {
      return this.fail(client, "GAME_ALREADY_STARTED", "La partie a déjà commencé.", ClientEvents.UPDATE_SETTINGS);
    }

    const updated = this.gameService.updateRoomSettings(
      code!,
      {
        totalRounds: data.totalRounds,
        gameMode: data.gameMode,
        teams: data.teams,
        artistBonusEnabled: data.artistBonusEnabled,
      },
      clientId,
    );

    if (!updated) {
      return this.fail(client, "INVALID_PAYLOAD", "Réglages refusés.", ClientEvents.UPDATE_SETTINGS);
    }

    this.server.to(this.room(code!)).emit(ServerEvents.ROOM_SETTINGS_UPDATED, this.settingsOf(updated));
    this.emitPlayers(code!);
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.SELECT_TEAM)
  handleSelectTeam(
    @MessageBody()
    data: {
      gameCode: string;
      teamId: string | null;
    },
    @ConnectedSocket() client: Socket,
  ): SocketAck {
    const clientId = resolveClientId(client);
    const code = data?.gameCode?.trim().toUpperCase();
    const game = code ? this.gameSessionManager.getGame(code) : undefined;
    if (!game) {
      return this.fail(client, "GAME_NOT_FOUND", "Ce salon n'existe plus.", ClientEvents.SELECT_TEAM);
    }
    if (!game.players.some((player) => player.id === clientId)) {
      return this.fail(client, "NOT_IN_GAME", "Tu n'es pas dans ce salon.", ClientEvents.SELECT_TEAM);
    }

    const updatedPlayer = this.gameService.selectTeam(code!, clientId, data.teamId);
    if (!updatedPlayer) {
      return this.fail(client, "GAME_ALREADY_STARTED", "Les équipes ne sont plus modifiables.", ClientEvents.SELECT_TEAM);
    }

    this.server.to(this.room(code!)).emit(ServerEvents.PLAYER_UPDATED, updatedPlayer);
    this.emitPlayers(code!);
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.START_GAME)
  handleStartGame(
    @MessageBody() data: { gameCode: string },
    @ConnectedSocket() client: Socket,
  ): SocketAck {
    const clientId = resolveClientId(client);
    const code = data?.gameCode?.trim().toUpperCase();
    const game = code ? this.gameSessionManager.getGame(code) : undefined;
    if (!game) {
      return this.fail(client, "GAME_NOT_FOUND", "Ce salon n'existe plus.", ClientEvents.START_GAME);
    }
    if (game.masterId !== clientId) {
      return this.fail(client, "NOT_HOST", "Seul l'hôte peut lancer la partie.", ClientEvents.START_GAME);
    }
    if (game.state !== GameState.LOBBY && game.state !== GameState.FINISHED) {
      return this.fail(client, "GAME_ALREADY_STARTED", "La partie a déjà commencé.", ClientEvents.START_GAME);
    }

    this.gameService.startGame(code!);
    return { ok: true };
  }

  @SubscribeMessage(ClientEvents.ANSWER)
  handleAnswer(
    @MessageBody() data: { gameCode: string; answer: string },
    @ConnectedSocket() client: Socket,
  ): SocketAck {
    const code = data?.gameCode?.trim().toUpperCase();
    if (!code || !data?.answer?.trim()) {
      return this.fail(client, "INVALID_PAYLOAD", "Réponse vide.", ClientEvents.ANSWER);
    }
    if (!this.gameSessionManager.getGame(code)) {
      return this.fail(client, "GAME_NOT_FOUND", "Ce salon n'existe plus.", ClientEvents.ANSWER);
    }

    this.gameService.verifyAnswer(code, data.answer, client);
    return { ok: true };
  }

  private detach(client: Socket, clientId: string, nextCode?: string) {
    const previous = this.registry.get(clientId);
    if (!previous || previous.gameCode === nextCode) {
      return;
    }

    client.leave(this.room(previous.gameCode));
    this.registry.cancelDisconnect(clientId);
    if (previous.role === "player") {
      this.gameSessionManager.removePlayer(previous.gameCode, clientId);
      this.server.to(this.room(previous.gameCode)).emit(ServerEvents.PLAYER_LEFT, {
        playerId: clientId,
      });
      this.emitPlayers(previous.gameCode);
    }
    this.registry.forget(clientId);
  }

  private emitPlayers(code: string) {
    const game = this.gameSessionManager.getGame(code);
    if (!game) return;
    this.server.to(this.room(code)).emit(ServerEvents.PLAYERS_UPDATED, {
      players: game.players,
    });
  }

  private settingsOf(game: GameSession) {
    return {
      totalRounds: game.totalRounds,
      gameMode: game.gameMode,
      teams: game.teams,
      artistBonusEnabled: game.artistBonusEnabled,
    };
  }

  private buildSync(game: GameSession, clientId: string): GameSyncPayload {
    const elapsed =
      game.roundStartTime > 0
        ? Math.floor(Date.now() / 1000) - game.roundStartTime
        : 0;
    const playing = game.state === GameState.PLAYING;
    const revealTrack =
      game.masterId === clientId ||
      game.state === GameState.RESULTS ||
      game.state === GameState.FINISHED;
    const track = game.getCurrentTrack();

    return {
      code: game.code,
      masterId: game.masterId,
      state: game.state,
      players: game.players,
      currentRound: game.currentRound,
      totalRounds: game.totalRounds,
      gameMode: game.gameMode,
      teams: game.getTeamScores(),
      artistBonusEnabled: game.artistBonusEnabled,
      correctPlayers: Array.from(game.correctPlayersForCurrentRound),
      correctTeams: Array.from(game.correctTeamsForCurrentRound),
      bonusPlayers: Array.from(game.bonusPlayersForCurrentRound),
      bonusTeams: Array.from(game.bonusTeamsForCurrentRound),
      playerName: game.players.find((player) => player.id === clientId)?.name,
      secondsLeft: playing ? Math.max(0, game.roundDurationSec - elapsed) : null,
      track: revealTrack && track ? (track as SyncTrack) : null,
      audioOffset: playing && game.masterId === clientId ? game.playbackStartSec + elapsed : null,
    };
  }

  private fail(
    client: Socket,
    code: GameErrorPayload["code"],
    message: string,
    event: string,
  ): SocketAck {
    const error: GameErrorPayload = { code, message, event };
    client.emit(ServerEvents.ERROR, error);
    return { ok: false, error };
  }

  private room(code: string) {
    return `game:${code}`;
  }
}
