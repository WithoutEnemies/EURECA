import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const NOTIFICATION_TYPES = {
  postComment: 'post_comment',
  commentReply: 'comment_reply',
} as const;

type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

type NotificationRow = {
  id: string;
  type: string;
  readAt?: Date | null;
  createdAt: Date;
  postId: string;
  commentId: string;
  actor: {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
  };
  post: {
    id: string;
    content: string;
  };
  comment: {
    id: string;
    content: string;
    parentCommentId?: string | null;
  };
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly notificationSelect = {
    id: true,
    type: true,
    readAt: true,
    createdAt: true,
    postId: true,
    commentId: true,
    actor: { select: { id: true, email: true, name: true, username: true } },
    post: { select: { id: true, content: true } },
    comment: {
      select: { id: true, content: true, parentCommentId: true },
    },
  } as const;

  private mapNotification(notification: NotificationRow) {
    return {
      id: notification.id,
      type: notification.type,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      postId: notification.postId,
      commentId: notification.commentId,
      actor: notification.actor,
      post: notification.post,
      comment: notification.comment,
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
