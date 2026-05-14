import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ConversationsRealtimeService } from './conversations-realtime.service';

type SocketAuthPayload = {
  sub: string;
  email: string;
};

type AuthenticatedSocket = Socket & {
  data: {
    user?: {
      userId: string;
      email: string;
    };
  };
};

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  },
})
export class ConversationsGateway
  implements OnGatewayInit, OnGatewayConnection
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly realtime: ConversationsRealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.attachServer(server);
  }

  async handleConnection(@ConnectedSocket() client: AuthenticatedSocket) {
    const token = this.getToken(client);

    try {
      const payload = await this.jwt.verifyAsync<SocketAuthPayload>(token);
      client.data.user = {
        userId: payload.sub,
        email: payload.email,
      };
      await client.join(this.realtime.userRoom(payload.sub));
    } catch {
      client.disconnect(true);
    }
  }

  private getToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }

    return '';
  }
}
