import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommentsService } from './comments.service';

type PrismaPostMock = {
  findUnique: jest.Mock;
};

type PrismaCommentMock = {
  findMany: jest.Mock;
  create: jest.Mock;
  count: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

type NotificationsMock = {
  notifyCommentCreated: jest.Mock;
};

describe('CommentsService', () => {
  let service: CommentsService;
  let post: PrismaPostMock;
  let comment: PrismaCommentMock;
  let notifications: NotificationsMock;

  beforeEach(() => {
    post = {
      findUnique: jest.fn(),
    };

    comment = {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    notifications = {
      notifyCommentCreated: jest.fn().mockResolvedValue(undefined),
    };

    service = new CommentsService(
      {
        post,
        comment,
      } as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it('create stores a comment linked to the post and authenticated author', async () => {
    const createdAt = new Date('2026-04-27T12:00:00.000Z');

    post.findUnique.mockResolvedValue({ id: 'post-1' });
    comment.create.mockResolvedValue({
      id: 'comment-1',
      content: 'Boa ideia',
      createdAt,
      updatedAt: createdAt,
      postId: 'post-1',
      parentCommentId: null,
      author: {
        id: 'user-1',
        email: 'dev@eureca.local',
        name: null,
        username: 'dev',
      },
    });
    comment.count.mockResolvedValue(1);

    await expect(
      service.create('post-1', 'user-1', 'Boa ideia'),
    ).resolves.toEqual({
      comment: {
        id: 'comment-1',
        content: 'Boa ideia',
        createdAt,
        updatedAt: createdAt,
        postId: 'post-1',
        parentCommentId: null,
        repliesCount: 0,
        author: {
          id: 'user-1',
          email: 'dev@eureca.local',
          name: null,
          username: 'dev',
        },
      },
      commentsCount: 1,
    });

    expect(comment.create).toHaveBeenCalledWith({
      data: {
        postId: 'post-1',
        authorId: 'user-1',
        content: 'Boa ideia',
        parentCommentId: undefined,
      },
      select: expect.any(Object),
    });
    expect(comment.count).toHaveBeenCalledWith({
      where: { postId: 'post-1' },
    });
    expect(notifications.notifyCommentCreated).toHaveBeenCalledWith({
      postId: 'post-1',
      commentId: 'comment-1',
      actorId: 'user-1',
      parentCommentId: null,
    });
  });

  it('create stores a reply linked to a parent comment from the same post', async () => {
    const createdAt = new Date('2026-04-27T12:01:00.000Z');

    post.findUnique.mockResolvedValue({ id: 'post-1' });
    comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      postId: 'post-1',
    });
    comment.create.mockResolvedValue({
      id: 'comment-2',
      content: 'Respondendo',
      createdAt,
      updatedAt: createdAt,
      postId: 'post-1',
      parentCommentId: 'comment-1',
      author: {
        id: 'user-2',
        email: 'reply@eureca.local',
        name: null,
        username: 'reply',
      },
    });
    comment.count.mockResolvedValue(2);

    await expect(
      service.create('post-1', 'user-2', 'Respondendo', 'comment-1'),
    ).resolves.toEqual({
      comment: {
        id: 'comment-2',
        content: 'Respondendo',
        createdAt,
        updatedAt: createdAt,
        postId: 'post-1',
        parentCommentId: 'comment-1',
        repliesCount: 0,
        author: {
          id: 'user-2',
          email: 'reply@eureca.local',
          name: null,
          username: 'reply',
        },
      },
      commentsCount: 2,
    });

    expect(comment.create).toHaveBeenCalledWith({
      data: {
        postId: 'post-1',
        authorId: 'user-2',
        content: 'Respondendo',
        parentCommentId: 'comment-1',
      },
      select: expect.any(Object),
    });
    expect(notifications.notifyCommentCreated).toHaveBeenCalledWith({
      postId: 'post-1',
      commentId: 'comment-2',
      actorId: 'user-2',
      parentCommentId: 'comment-1',
    });
  });

  it('create rejects replies to comments from another post', async () => {
    post.findUnique.mockResolvedValue({ id: 'post-1' });
    comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      postId: 'post-2',
    });

    await expect(
      service.create('post-1', 'user-2', 'Respondendo', 'comment-1'),
    ).rejects.toThrow('A resposta precisa pertencer ao mesmo post');
  });

  it('findForPost rejects unknown posts', async () => {
    post.findUnique.mockResolvedValue(null);

    await expect(service.findForPost('missing-post')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findForPost returns a paginated root comment page', async () => {
    const firstDate = new Date('2026-04-27T12:00:00.000Z');
    const secondDate = new Date('2026-04-27T12:01:00.000Z');
    const thirdDate = new Date('2026-04-27T12:02:00.000Z');

    post.findUnique.mockResolvedValue({ id: 'post-1' });
    comment.findMany.mockResolvedValue([
      {
        id: 'comment-1',
        content: 'Primeiro',
        createdAt: firstDate,
        updatedAt: firstDate,
        postId: 'post-1',
        parentCommentId: null,
        _count: { replies: 2 },
        author: {
          id: 'user-1',
          email: 'dev@eureca.local',
          name: null,
          username: 'dev',
        },
      },
      {
        id: 'comment-2',
        content: 'Segundo',
        createdAt: secondDate,
        updatedAt: secondDate,
        postId: 'post-1',
        parentCommentId: null,
        _count: { replies: 0 },
        author: {
          id: 'user-2',
          email: 'reply@eureca.local',
          name: null,
          username: 'reply',
        },
      },
      {
        id: 'comment-3',
        content: 'Terceiro',
        createdAt: thirdDate,
        updatedAt: thirdDate,
        postId: 'post-1',
        parentCommentId: null,
        _count: { replies: 0 },
        author: {
          id: 'user-3',
          email: 'third@eureca.local',
          name: null,
          username: 'third',
        },
      },
    ]);
    comment.count.mockResolvedValue(8);

    await expect(service.findForPost('post-1', { limit: 2 })).resolves.toEqual({
      items: [
        {
          id: 'comment-1',
          content: 'Primeiro',
          createdAt: firstDate,
          updatedAt: firstDate,
          postId: 'post-1',
          parentCommentId: null,
          repliesCount: 2,
          author: {
            id: 'user-1',
            email: 'dev@eureca.local',
            name: null,
            username: 'dev',
          },
        },
        {
          id: 'comment-2',
          content: 'Segundo',
          createdAt: secondDate,
          updatedAt: secondDate,
          postId: 'post-1',
          parentCommentId: null,
          repliesCount: 0,
          author: {
            id: 'user-2',
            email: 'reply@eureca.local',
            name: null,
            username: 'reply',
          },
        },
      ],
      hasMore: true,
      nextCursor: 'comment-2',
      commentsCount: 8,
    });
    expect(comment.findMany).toHaveBeenCalledWith({
      where: { postId: 'post-1', parentCommentId: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 3,
      select: expect.any(Object),
    });
  });

  it('findForPost rejects cursors outside the requested comment page scope', async () => {
    const createdAt = new Date('2026-04-27T12:00:00.000Z');

    post.findUnique.mockResolvedValue({ id: 'post-1' });
    comment.findUnique
      .mockResolvedValueOnce({
        id: 'comment-1',
        postId: 'post-1',
      })
      .mockResolvedValueOnce({
        id: 'comment-2',
        postId: 'post-1',
        parentCommentId: null,
        createdAt,
      });

    await expect(
      service.findForPost('post-1', {
        parentCommentId: 'comment-1',
        cursor: 'comment-2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update rejects comments from another author', async () => {
    comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      postId: 'post-1',
      authorId: 'owner-user',
    });

    await expect(
      service.update('comment-1', 'other-user', 'Texto novo'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('remove deletes comments owned by the requester', async () => {
    comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      postId: 'post-1',
      authorId: 'user-1',
    });
    comment.delete.mockResolvedValue({ id: 'comment-1' });
    comment.count.mockResolvedValue(0);

    await expect(service.remove('comment-1', 'user-1')).resolves.toEqual({
      commentId: 'comment-1',
      postId: 'post-1',
      deleted: true,
      commentsCount: 0,
    });

    expect(comment.delete).toHaveBeenCalledWith({
      where: { id: 'comment-1' },
    });
  });

  it('remove lets the post author delete comments on their post', async () => {
    comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      postId: 'post-1',
      authorId: 'comment-author',
    });
    post.findUnique.mockResolvedValue({ authorId: 'post-author' });
    comment.delete.mockResolvedValue({ id: 'comment-1' });
    comment.count.mockResolvedValue(0);

    await expect(service.remove('comment-1', 'post-author')).resolves.toEqual({
      commentId: 'comment-1',
      postId: 'post-1',
      deleted: true,
      commentsCount: 0,
    });

    expect(post.findUnique).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      select: { authorId: true },
    });
  });

  it('remove rejects users who are neither comment author nor post author', async () => {
    comment.findUnique.mockResolvedValue({
      id: 'comment-1',
      postId: 'post-1',
      authorId: 'comment-author',
    });
    post.findUnique.mockResolvedValue({ authorId: 'post-author' });

    await expect(
      service.remove('comment-1', 'other-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
