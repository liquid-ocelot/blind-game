import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";



@WebSocketGateway(
    {
        cors: {
            origin: ['http://localhost:3000', 'http://192.168.1.16:3000']
        }
    }
)
export class GameGateway {


    @WebSocketServer()
    server: Server;


    @SubscribeMessage('ping')
    handlePing(
        @MessageBody() data: {message: string},
        @ConnectedSocket() client: Socket
    ) {
        console.log('Ping reçu :', data);

        client.emit('pong', {message : 'Hello JS'});
    }


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


}