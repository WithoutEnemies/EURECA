import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from './posts.service';

type PrismaPostMock = {
  create: jest.Mock;
  findMany: jest.Mock;
  findUnique: jest.Mock;
  update: jest.Mock;
};

type PrismaPostLikeMock = {
  upsert: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  findUnique: jest.Mock;
};

describe('PostsService', () => {
  let service: PostsService;
  let post: PrismaPostMock;
  let postLike: PrismaPostLikeMock;
  let transaction: jest.Mock;
  let notifications: { notifyPostLiked: jest.Mock };

  beforeEach(() => {
    post = {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    };

    postLike = {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    };

    transaction = jest.fn();
    notifications = { notifyPostLiked: jest.fn() };

    service = new PostsService(
      {
        post,
        postLike,
        $transaction: transaction,
      } as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });

  it('create returns the mapped post payload for the API', async () => {
    const createdAt = new Date('2026-02-10T08:00:00.000Z');

    post.create.mockResolvedValue({
      id: 'post-1',
      content: 'Primeiro post',
      createdAt,
      viewCount: 0,
      author: { id: 'user-1', email: 'dev@eureca.local' },
      _count: { likes: 0, comments: 0 },
      likes: [],
    });

    await expect(service.create('user-1', 'Primeiro post')).resolves.toEqual({
      id: 'post-1',
      content: 'Primeiro post',
      imageUrl: null,
      createdAt,
      viewCount: 0,
      likesCount: 0,
      commentsCount: 0,
      viewerLiked: false,
      author: { id: 'user-1', email: 'dev@eureca.local' },
    });
  });

  it('create stores and returns an optional image reference', async () => {
    const createdAt = new Date('2026-02-10T08:00:00.000Z');
    const imageUrl = 'https://cdn.eureca.local/posts/post-1.webp';

    post.create.mockResolvedValue({
      id: 'post-1',
      content: 'Post com imagem',
      imageUrl,
      createdAt,
      viewCount: 0,
      author: { id: 'user-1', email: 'dev@eureca.local' },
      _count: { likes: 0, comments: 0 },
      likes: [],
    });

    await expect(
      service.create('user-1', 'Post com imagem', `  ${imageUrl}  `),
    ).resolves.toEqual({
      id: 'post-1',
      content: 'Post com imagem',
      imageUrl,
      createdAt,
      viewCount: 0,
      likesCount: 0,
      commentsCount: 0,
      viewerLiked: false,
      author: { id: 'user-1', email: 'dev@eureca.local' },
    });

    expect(post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          content: 'Post com imagem',
          authorId: 'user-1',
          imageUrl,
        },
      }),
    );
  });

  it('like creates or reuses the reaction and returns the new state', async () => {
    post.findUnique.mockResolvedValue({ id: 'post-1', authorId: 'author-1' });
    postLike.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'like-1' });
    postLike.upsert.mockResolvedValue({ id: 'like-1' });
    transaction.mockResolvedValue([1, { id: 'like-1' }]);

    await expect(service.like('post-1', 'user-1')).resolves.toEqual({
      postId: 'post-1',
      likesCount: 1,
      viewerLiked: true,
    });

    expect(postLike.upsert).toHaveBeenCalledWith({
      where: { postId_userId: { postId: 'post-1', userId: 'user-1' } },
      update: {},
      create: { postId: 'post-1', userId: 'user-1' },
    });
    expect(notifications.notifyPostLiked).toHaveBeenCalledWith({
      postId: 'post-1',
      actorId: 'user-1',
    });
  });

  it('like does not notify when the reaction already exists', async () => {
    post.findUnique.mockResolvedValue({ id: 'post-1', authorId: 'author-1' });
    postLike.findUnique.mockResolvedValue({ id: 'like-1' });
    postLike.upsert.mockResolvedValue({ id: 'like-1' });
    transaction.mockResolvedValue([1, { id: 'like-1' }]);

    await expect(service.like('post-1', 'user-1')).resolves.toEqual({
      postId: 'post-1',
      likesCount: 1,
      viewerLiked: true,
    });

    expect(notifications.notifyPostLiked).not.toHaveBeenCalled();
  });

  it('like does not notify the author about their own like', async () => {
    post.findUnique.mockResolvedValue({ id: 'post-1', authorId: 'user-1' });
    postLike.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'like-1' });
    postLike.upsert.mockResolvedValue({ id: 'like-1' });
    transaction.mockResolvedValue([1, { id: 'like-1' }]);

    await expect(service.like('post-1', 'user-1')).resolves.toEqual({
      postId: 'post-1',
      likesCount: 1,
      viewerLiked: true,
    });

    expect(notifications.notifyPostLiked).not.toHaveBeenCalled();
  });

  it('like rejects unknown posts', async () => {
    post.findUnique.mockResolvedValue(null);

    await expect(service.like('missing-post', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('unlike removes the reaction and returns the updated state', async () => {
    postLike.deleteMany.mockResolvedValue({ count: 1 });
    transaction.mockResolvedValue([0, null]);

    await expect(service.unlike('post-1', 'user-1')).resolves.toEqual({
      postId: 'post-1',
      likesCount: 0,
      viewerLiked: false,
    });

    expect(postLike.deleteMany).toHaveBeenCalledWith({
      where: { postId: 'post-1', userId: 'user-1' },
    });
  });

  it('addView increments the stored view counter', async () => {
    post.update.mockResolvedValue({
      id: 'post-1',
      viewCount: 3,
    });

    await expect(service.addView('post-1')).resolves.toEqual({
      postId: 'post-1',
      viewCount: 3,
    });
  });
});
