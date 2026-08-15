import { ClientEvents } from "@blindtest/shared";
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { GameService } from "./game.service";



@WebSocketGateway({
    cors: {
        origin: process.env.NODE_ENV === "production"
            ? process.env.WEB_ORIGIN?.split(",") ?? []
            : true,
    },
})
export class GameGateway {


    @WebSocketServer()
    server: Server;

    constructor(private gameService: GameService) {
        
    }


    @SubscribeMessage('ping')
    handlePing(
        @MessageBody() data: {message: string},
        @ConnectedSocket() client: Socket
    ) {
        console.log('Ping reçu :', data);

        client.emit('pong', {message : 'Hello JS'});
    }


    //@SubscribeMessage(ClientEvents.JOIN_GAME)
    @SubscribeMessage('game:join')
    handleJoinGame(
        @MessageBody() data: {
            gameCode: string;
            playerName: string
        },
        @ConnectedSocket() client: Socket
    ) {
        client.join(`game:${data.gameCode}`);

        const player = {
            id: client.id,
            name: data.playerName
        };

        this.server
        .to(`game:${data.gameCode}`)
        .emit('game:player-joined', player)
        //.emit(ServerEvents.PLAYER_JOINED, player);
    }


    @SubscribeMessage(ClientEvents.CREATE_GAME)
    //@SubscribeMessage('game:create')
    handleCreateGame(
        @ConnectedSocket() client: Socket
    ) {
        const code = this.gameService.createGame(client.id);
        client.join(`game:${code}`);

        client.emit('game:created', {code})
    }


}