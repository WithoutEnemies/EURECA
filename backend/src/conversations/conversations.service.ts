import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type UserSummary = {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  role?: string | null;
  eurecaPlusPlan?: string | null;
  eurecaPlusSince?: Date | null;
};

type ParticipantRow = {
  userId: string;
  lastReadAt?: Date | null;
  createdAt: Date;
  user: UserSummary;
};

type MessageRow = {
  id: string;
  content: string;
  createdAt: Date;
  conversationId: string;
  senderId: string;
  sender: UserSummary;
};

type ConversationRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  participants: ParticipantRow[];
  messages?: MessageRow[];
};

type FindMessagesOptions = {
  cursor?: string;
  limit?: string | number;
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly userSelect = {
    id: true,
    email: true,
    name: true,
    username: true,
    role: true,
    eurecaPlusPlan: true,
    eurecaPlusSince: true,
  } as const;

  private readonly participantSelect = {
    userId: true,
    lastReadAt: true,
    createdAt: true,
    user: { select: this.userSelect },
  } as const;

  private readonly messageSelect = {
    id: true,
    content: true,
    createdAt: true,
    conversationId: true,
    senderId: true,
    sender: { select: this.userSelect },
  } as const;

  private readonly defaultMessagePageSize = 30;
  private readonly maxMessagePageSize = 50;

  async findForUser(userId: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        participants: { select: this.participantSelect },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: this.messageSelect,
        },
      },
    });

    return Promise.all(
      rows.map((conversation) => this.mapConversation(conversation, userId)),
    );
  }

  async createDirect(userId: string, participantId: string) {
    if (userId === participantId) {
      throw new BadRequestException(
        'Não é possível iniciar conversa consigo mesmo.',
      );
    }

    await this.assertUserExists(participantId);
    const existing = await this.findDirectConversation(userId, participantId);

    if (existing) {
      return this.mapConversation(existing, userId);
    }

    const created = await this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: participantId }],
        },
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        participants: { select: this.participantSelect },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: this.messageSelect,
        },
      },
    });

    return this.mapConversation(created, userId);
  }

  async findMessages(
    conversationId: string,
    userId: string,
    options: FindMessagesOptions = {},
  ) {
    await this.assertParticipant(conversationId, userId);
    const limit = this.normalizeLimit(options.limit);
    const cursorMessage = await this.findPaginationCursor(
      conversationId,
      options.cursor,
    );
    const rows = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursorMessage
          ? {
              OR: [
                { createdAt: { lt: cursorMessage.createdAt } },
                {
                  createdAt: cursorMessage.createdAt,
                  id: { lt: cursorMessage.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: this.messageSelect,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const oldestMessage = pageRows.at(-1);

    return {
      items: pageRows.reverse().map((message) => this.mapMessage(message)),
      hasMore,
      nextCursor: hasMore && oldestMessage ? oldestMessage.id : null,
    };
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    content: string,
  ) {
    await this.assertParticipant(conversationId, senderId);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId,
          content: content.trim(),
        },
        select: this.messageSelect,
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: created.createdAt },
        select: { id: true },
      });

      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: senderId } },
        data: { lastReadAt: created.createdAt },
        select: { conversationId: true },
      });

      return created;
    });

    await this.notifications.notifyPrivateMessageCreated({
      conversationId,
      messageId: message.id,
      actorId: senderId,
    });

    return this.mapMessage(message);
  }

  async markRead(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);

    const updated = await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
      select: {
        conversationId: true,
        userId: true,
        lastReadAt: true,
      },
    });

    return updated;
  }

  async findParticipantIds(conversationId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });

    return participants.map((participant) => participant.userId);
  }

  private async findDirectConversation(userId: string, participantId: string) {
    const rows = await this.prisma.conversation.findMany({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: participantId } } },
          {
            participants: {
              every: { userId: { in: [userId, participantId] } },
            },
          },
        ],
      },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        participants: { select: this.participantSelect },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: this.messageSelect,
        },
        _count: { select: { participants: true } },
      },
    });
    const exact = rows.find((row) => row._count.participants === 2);
    if (!exact) return null;
    const { _count: _count, ...conversation } = exact;
    void _count;
    return conversation;
  }

  private async mapConversation(
    conversation: ConversationRow,
    viewerId: string,
  ) {
    const viewerParticipant = conversation.participants.find(
      (participant) => participant.userId === viewerId,
    );
    const unreadCount = await this.countUnreadMessages(
      conversation.id,
      viewerId,
      viewerParticipant?.lastReadAt,
    );
    const lastMessage = conversation.messages?.[0] ?? null;

    return {
      id: conversation.id,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      participants: conversation.participants.map((participant) => ({
        userId: participant.userId,
        lastReadAt: participant.lastReadAt,
        createdAt: participant.createdAt,
        user: participant.user,
      })),
      otherParticipants: conversation.participants
        .filter((participant) => participant.userId !== viewerId)
        .map((participant) => participant.user),
      lastMessage: lastMessage ? this.mapMessage(lastMessage) : null,
      unreadCount,
    };
  }

  private mapMessage(message: MessageRow) {
    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sender: message.sender,
    };
  }

  private async countUnreadMessages(
    conversationId: string,
    userId: string,
    lastReadAt?: Date | null,
  ) {
    return this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { conversationId: true },
    });

    if (!participant) {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });

      if (!conversation) {
        throw new NotFoundException('Conversa não encontrada.');
      }

      throw new ForbiddenException('Você não participa desta conversa.');
    }
  }

  private normalizeLimit(value?: string | number) {
    const parsed = Number(value ?? this.defaultMessagePageSize);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return this.defaultMessagePageSize;
    }

    return Math.min(Math.floor(parsed), this.maxMessagePageSize);
  }

  private async findPaginationCursor(conversationId: string, cursor?: string) {
    if (!cursor) return null;

    const message = await this.prisma.message.findUnique({
      where: { id: cursor },
      select: { id: true, conversationId: true, createdAt: true },
    });

    if (!message || message.conversationId !== conversationId) {
      throw new BadRequestException('Cursor de mensagem inválido.');
    }

    return message;
  }
}
