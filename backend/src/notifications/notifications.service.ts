import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const NOTIFICATION_TYPES = {
  postComment: 'post_comment',
  commentReply: 'comment_reply',
  postLike: 'post_like',
  privateMessage: 'private_message',
  platformNotice: 'platform_notice',
} as const;

type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

type NotificationRow = {
  id: string;
  type: string;
  title?: string | null;
  body?: string | null;
  readAt?: Date | null;
  createdAt: Date;
  postId?: string | null;
  commentId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  actor?: {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
  } | null;
  post?: {
    id: string;
    content: string;
    imageUrl?: string | null;
  } | null;
  comment?: {
    id: string;
    content: string;
    parentCommentId?: string | null;
  } | null;
  conversation?: {
    id: string;
  } | null;
  message?: {
    id: string;
    content: string;
    conversationId: string;
  } | null;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly notificationSelect = {
    id: true,
    type: true,
    title: true,
    body: true,
    readAt: true,
    createdAt: true,
    postId: true,
    commentId: true,
    conversationId: true,
    messageId: true,
    actor: { select: { id: true, email: true, name: true, username: true } },
    post: { select: { id: true, content: true, imageUrl: true } },
    comment: {
      select: { id: true, content: true, parentCommentId: true },
    },
    conversation: { select: { id: true } },
    message: { select: { id: true, content: true, conversationId: true } },
  } as const;

  private mapNotification(notification: NotificationRow) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title ?? null,
      body: notification.body ?? null,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      postId: notification.postId ?? null,
      commentId: notification.commentId ?? null,
      conversationId: notification.conversationId ?? null,
      messageId: notification.messageId ?? null,
      actor: notification.actor ?? null,
      post: notification.post ?? null,
      comment: notification.comment ?? null,
      conversation: notification.conversation ?? null,
      message: notification.message ?? null,
    };
  }

  async findForUser(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: this.notificationSelect,
    });

    return rows.map((notification) => this.mapNotification(notification));
  }

  async markRead(notificationId: string, userId: string) {
    await this.assertNotificationOwner(notificationId, userId);

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
      select: this.notificationSelect,
    });

    return this.mapNotification(updated);
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { updatedCount: result.count };
  }

  async notifyCommentCreated({
    postId,
    commentId,
    actorId,
    parentCommentId,
  }: {
    postId: string;
    commentId: string;
    actorId: string;
    parentCommentId?: string | null;
  }) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    const parentComment = parentCommentId
      ? await this.prisma.comment.findUnique({
          where: { id: parentCommentId },
          select: { authorId: true },
        })
      : null;

    if (!post) {
      return;
    }

    const recipients = new Map<string, NotificationType>();

    if (parentComment?.authorId && parentComment.authorId !== actorId) {
      recipients.set(parentComment.authorId, NOTIFICATION_TYPES.commentReply);
    }

    if (post.authorId !== actorId && !recipients.has(post.authorId)) {
      recipients.set(post.authorId, NOTIFICATION_TYPES.postComment);
    }

    for (const [recipientId, type] of recipients) {
      await this.prisma.notification.create({
        data: {
          type,
          recipientId,
          actorId,
          postId,
          commentId,
        },
      });
    }
  }

  async notifyPostLiked({
    postId,
    actorId,
  }: {
    postId: string;
    actorId: string;
  }) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post || post.authorId === actorId) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        type: NOTIFICATION_TYPES.postLike,
        recipientId: post.authorId,
        actorId,
        postId,
      },
    });
  }

  async notifyPrivateMessageCreated({
    conversationId,
    messageId,
    actorId,
  }: {
    conversationId: string;
    messageId: string;
    actorId: string;
  }) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: actorId } },
      select: { userId: true },
    });

    for (const participant of participants) {
      await this.prisma.notification.create({
        data: {
          type: NOTIFICATION_TYPES.privateMessage,
          recipientId: participant.userId,
          actorId,
          conversationId,
          messageId,
        },
      });
    }
  }

  async notifyPlatformNotice({
    recipientId,
    title,
    body,
  }: {
    recipientId: string;
    title: string;
    body?: string | null;
  }) {
    await this.prisma.notification.create({
      data: {
        type: NOTIFICATION_TYPES.platformNotice,
        recipientId,
        title: title.trim(),
        body: body?.trim() || null,
      },
    });
  }

  private async assertNotificationOwner(
    notificationId: string,
    userId: string,
  ) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }
  }
}
