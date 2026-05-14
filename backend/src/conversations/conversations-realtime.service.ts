import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class ConversationsRealtimeService {
  private server?: Server;

  attachServer(server: Server) {
    this.server = server;
  }

  emitMessage(userIds: string[], message: unknown) {
    if (!this.server) return;

    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    uniqueUserIds.forEach((userId) => {
      this.server?.to(this.userRoom(userId)).emit('conversation:message', {
        message,
      });
    });
  }

  userRoom(userId: string) {
    return `user:${userId}`;
  }
}
