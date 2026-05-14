import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_TYPES,
  NotificationsService,
} from './notifications.service';

type PrismaNotificationMock = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  create: jest.Mock;
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let post: { findUnique: jest.Mock };
  let comment: { findUnique: jest.Mock };
  let conversationParticipant: { findMany: jest.Mock };
  let notification: PrismaNotificationMock;

  beforeEach(() => {
    post = { findUnique: jest.fn() };
    comment = { findUnique: jest.fn() };
    conversationParticipant = { findMany: jest.fn() };
    notification = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    };

    service = new NotificationsService({
      post,
      comment,
      conversationParticipant,
      notification,
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    } as unknown as PrismaService);
  });

  it('creates one notification for a comment on another user post', async () => {
    post.findUnique.mockResolvedValue({ authorId: 'post-author' });

    await service.notifyCommentCreated({
      postId: 'post-1',
      commentId: 'comment-1',
      actorId: 'comment-author',
    });

    expect(notification.create).toHaveBeenCalledWith({
      data: {
        type: NOTIFICATION_TYPES.postComment,
        recipientId: 'post-author',
        actorId: 'comment-author',
        postId: 'post-1',
        commentId: 'comment-1',
      },
    });
  });

  it('does not notify the actor about their own post comment', async () => {
    post.findUnique.mockResolvedValue({ authorId: 'actor-user' });

    await service.notifyCommentCreated({
      postId: 'post-1',
      commentId: 'comment-1',
      actorId: 'actor-user',
    });

    expect(notification.create).not.toHaveBeenCalled();
  });

  it('prioritizes reply notifications and avoids duplicate recipients', async () => {
    post.findUnique.mockResolvedValue({ authorId: 'post-author' });
    comment.findUnique.mockResolvedValue({ authorId: 'post-author' });

    await service.notifyCommentCreated({
      postId: 'post-1',
      commentId: 'comment-2',
      actorId: 'reply-author',
      parentCommentId: 'comment-1',
    });

    expect(notification.create).toHaveBeenCalledTimes(1);
    expect(notification.create).toHaveBeenCalledWith({
      data: {
        type: NOTIFICATION_TYPES.commentReply,
        recipientId: 'post-author',
        actorId: 'reply-author',
        postId: 'post-1',
        commentId: 'comment-2',
      },
    });
  });

  it('notifies both the replied comment author and post author when they differ', async () => {
    post.findUnique.mockResolvedValue({ authorId: 'post-author' });
    comment.findUnique.mockResolvedValue({ authorId: 'comment-author' });

    await service.notifyCommentCreated({
      postId: 'post-1',
      commentId: 'comment-2',
      actorId: 'reply-author',
      parentCommentId: 'comment-1',
    });

    expect(notification.create).toHaveBeenCalledTimes(2);
    expect(notification.create).toHaveBeenNthCalledWith(1, {
      data: {
        type: NOTIFICATION_TYPES.commentReply,
        recipientId: 'comment-author',
        actorId: 'reply-author',
        postId: 'post-1',
        commentId: 'comment-2',
      },
    });
    expect(notification.create).toHaveBeenNthCalledWith(2, {
      data: {
        type: NOTIFICATION_TYPES.postComment,
        recipientId: 'post-author',
        actorId: 'reply-author',
        postId: 'post-1',
        commentId: 'comment-2',
      },
    });
  });

  it('creates one notification when someone likes another user post', async () => {
    post.findUnique.mockResolvedValue({ authorId: 'post-author' });

    await service.notifyPostLiked({
      postId: 'post-1',
      actorId: 'liker-user',
    });

    expect(notification.create).toHaveBeenCalledWith({
      data: {
        type: NOTIFICATION_TYPES.postLike,
        recipientId: 'post-author',
        actorId: 'liker-user',
        postId: 'post-1',
      },
    });
  });

  it('does not notify the actor about their own post like', async () => {
    post.findUnique.mockResolvedValue({ authorId: 'actor-user' });

    await service.notifyPostLiked({
      postId: 'post-1',
      actorId: 'actor-user',
    });

    expect(notification.create).not.toHaveBeenCalled();
  });

  it('creates private message notifications for other participants', async () => {
    conversationParticipant.findMany.mockResolvedValue([
      { userId: 'recipient-1' },
      { userId: 'recipient-2' },
    ]);

    await service.notifyPrivateMessageCreated({
      conversationId: 'conversation-1',
      messageId: 'message-1',
      actorId: 'sender-user',
    });

    expect(conversationParticipant.findMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'conversation-1',
        userId: { not: 'sender-user' },
      },
      select: { userId: true },
    });
    expect(notification.create).toHaveBeenCalledTimes(2);
    expect(notification.create).toHaveBeenNthCalledWith(1, {
      data: {
        type: NOTIFICATION_TYPES.privateMessage,
        recipientId: 'recipient-1',
        actorId: 'sender-user',
        conversationId: 'conversation-1',
        messageId: 'message-1',
      },
    });
    expect(notification.create).toHaveBeenNthCalledWith(2, {
      data: {
        type: NOTIFICATION_TYPES.privateMessage,
        recipientId: 'recipient-2',
        actorId: 'sender-user',
        conversationId: 'conversation-1',
        messageId: 'message-1',
      },
    });
  });

  it('creates platform notices without an actor', async () => {
    await service.notifyPlatformNotice({
      recipientId: 'recipient-user',
      title: 'Manutenção programada',
      body: 'A plataforma será atualizada hoje.',
    });

    expect(notification.create).toHaveBeenCalledWith({
      data: {
        type: NOTIFICATION_TYPES.platformNotice,
        recipientId: 'recipient-user',
        title: 'Manutenção programada',
        body: 'A plataforma será atualizada hoje.',
      },
    });
  });

  it('marks all unread notifications for a user as read', async () => {
    notification.updateMany.mockResolvedValue({ count: 3 });

    await expect(service.markAllRead('recipient-user')).resolves.toEqual({
      updatedCount: 3,
    });
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { recipientId: 'recipient-user', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('marks only notifications that belong to the requester as read', async () => {
    const createdAt = new Date('2026-04-27T12:00:00.000Z');
    const readAt = new Date('2026-04-27T12:02:00.000Z');

    notification.findFirst.mockResolvedValue({ id: 'notification-1' });
    notification.update.mockResolvedValue({
      id: 'notification-1',
      type: NOTIFICATION_TYPES.postComment,
      title: null,
      body: null,
      readAt,
      createdAt,
      postId: 'post-1',
      commentId: 'comment-1',
      conversationId: null,
      messageId: null,
      actor: {
        id: 'actor-user',
        email: 'actor@eureca.local',
        name: null,
        username: 'actor',
      },
      post: {
        id: 'post-1',
        content: 'Post',
      },
      comment: {
        id: 'comment-1',
        content: 'Comentario',
        parentCommentId: null,
      },
    });

    await expect(
      service.markRead('notification-1', 'recipient-user'),
    ).resolves.toEqual({
      id: 'notification-1',
      type: NOTIFICATION_TYPES.postComment,
      title: null,
      body: null,
      readAt,
      createdAt,
      postId: 'post-1',
      commentId: 'comment-1',
      conversationId: null,
      messageId: null,
      actor: {
        id: 'actor-user',
        email: 'actor@eureca.local',
        name: null,
        username: 'actor',
      },
      post: {
        id: 'post-1',
        content: 'Post',
      },
      comment: {
        id: 'comment-1',
        content: 'Comentario',
        parentCommentId: null,
      },
      conversation: null,
      message: null,
    });
    expect(notification.findFirst).toHaveBeenCalledWith({
      where: { id: 'notification-1', recipientId: 'recipient-user' },
      select: { id: true },
    });
  });

  it('rejects markRead for notifications from another user', async () => {
    notification.findFirst.mockResolvedValue(null);

    await expect(
      service.markRead('notification-1', 'other-user'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
