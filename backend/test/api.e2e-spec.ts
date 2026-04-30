import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { InMemoryPrismaService } from './support/in-memory-prisma';

type AuthResponseBody = {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
    role: string | null;
    bio: string | null;
    interests: string[];
    createdAt: string;
  };
};

function isAuthResponseBody(value: unknown): value is AuthResponseBody {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    access_token?: unknown;
    user?: {
      id?: unknown;
      email?: unknown;
      name?: unknown;
      username?: unknown;
      role?: unknown;
      bio?: unknown;
      interests?: unknown;
      createdAt?: unknown;
    };
  };

  return (
    typeof candidate.access_token === 'string' &&
    typeof candidate.user?.id === 'string' &&
    typeof candidate.user.email === 'string' &&
    (typeof candidate.user.name === 'string' || candidate.user.name === null) &&
    (typeof candidate.user.username === 'string' ||
      candidate.user.username === null) &&
    (typeof candidate.user.role === 'string' || candidate.user.role === null) &&
    (typeof candidate.user.bio === 'string' || candidate.user.bio === null) &&
    Array.isArray(candidate.user.interests) &&
    typeof candidate.user.createdAt === 'string'
  );
}

async function registerTestUser(app: INestApplication<App>, email: string) {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password: 'dev123456' })
    .expect(201);

  const body: unknown = response.body;
  expect(isAuthResponseBody(body)).toBe(true);

  if (!isAuthResponseBody(body)) {
    throw new Error('Invalid register response');
  }

  return body;
}

describe('API flows (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: InMemoryPrismaService;

  beforeEach(async () => {
    prisma = new InMemoryPrismaService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers, logs in and returns the authenticated profile contract', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'DEV@EURECA.LOCAL',
        password: 'dev123456',
        name: 'Dev Eureca',
        username: 'dev_eureca',
        role: 'Desenvolvimento',
        bio: 'Criando uma comunidade.',
        interests: ['Frontend', 'Backend'],
      })
      .expect(201);

    const registerBody: unknown = registerResponse.body;
    expect(isAuthResponseBody(registerBody)).toBe(true);

    if (!isAuthResponseBody(registerBody)) {
      throw new Error('Invalid register response');
    }

    expect(typeof registerBody.access_token).toBe('string');
    expect(registerBody.user).toEqual({
      id: 'user-1',
      email: 'dev@eureca.local',
      name: 'Dev Eureca',
      username: 'dev_eureca',
      role: 'Desenvolvimento',
      bio: 'Criando uma comunidade.',
      interests: ['Frontend', 'Backend'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(registerBody.user).not.toHaveProperty('password');

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'dev@eureca.local', password: 'dev123456' })
      .expect(201);

    const loginBody: unknown = loginResponse.body;
    expect(isAuthResponseBody(loginBody)).toBe(true);

    if (!isAuthResponseBody(loginBody)) {
      throw new Error('Invalid login response');
    }

    expect(typeof loginBody.access_token).toBe('string');
    expect(loginBody.user).toEqual({
      id: 'user-1',
      email: 'dev@eureca.local',
      name: 'Dev Eureca',
      username: 'dev_eureca',
      role: 'Desenvolvimento',
      bio: 'Criando uma comunidade.',
      interests: ['Frontend', 'Backend'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const usernameLoginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'dev_eureca', password: 'dev123456' })
      .expect(201);

    const usernameLoginBody: unknown = usernameLoginResponse.body;
    expect(isAuthResponseBody(usernameLoginBody)).toBe(true);

    if (!isAuthResponseBody(usernameLoginBody)) {
      throw new Error('Invalid username login response');
    }

    expect(usernameLoginBody.user).toEqual({
      id: 'user-1',
      email: 'dev@eureca.local',
      name: 'Dev Eureca',
      username: 'dev_eureca',
      role: 'Desenvolvimento',
      bio: 'Criando uma comunidade.',
      interests: ['Frontend', 'Backend'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    await request(app.getHttpServer())
      .get('/users/user-1')
      .expect(200)
      .expect({
        user: {
          id: 'user-1',
          email: 'dev@eureca.local',
          name: 'Dev Eureca',
          username: 'dev_eureca',
          role: 'Desenvolvimento',
          bio: 'Criando uma comunidade.',
          interests: ['Frontend', 'Backend'],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${loginBody.access_token}`)
      .expect(200)
      .expect({
        user: {
          id: 'user-1',
          email: 'dev@eureca.local',
          name: 'Dev Eureca',
          username: 'dev_eureca',
          role: 'Desenvolvimento',
          bio: 'Criando uma comunidade.',
          interests: ['Frontend', 'Backend'],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });
  });

  it('creates a post, likes it, unlikes it and increments its view count', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'writer@eureca.local', password: 'dev123456' })
      .expect(201);

    const registerBody: unknown = registerResponse.body;
    expect(isAuthResponseBody(registerBody)).toBe(true);

    if (!isAuthResponseBody(registerBody)) {
      throw new Error('Invalid register response');
    }

    const token = registerBody.access_token;

    const createResponse = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Meu primeiro post' })
      .expect(201);

    expect(createResponse.body).toEqual({
      id: 'post-1',
      content: 'Meu primeiro post',
      createdAt: '2026-01-01T00:00:01.000Z',
      viewCount: 0,
      likesCount: 0,
      commentsCount: 0,
      viewerLiked: false,
      author: {
        id: 'user-1',
        email: 'writer@eureca.local',
        name: null,
        username: null,
      },
    });

    await request(app.getHttpServer())
      .post('/posts/post-1/like')
      .set('Authorization', `Bearer ${token}`)
      .expect(201)
      .expect({
        postId: 'post-1',
        likesCount: 1,
        viewerLiked: true,
      });

    await request(app.getHttpServer())
      .delete('/posts/post-1/like')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({
        postId: 'post-1',
        likesCount: 0,
        viewerLiked: false,
      });

    await request(app.getHttpServer())
      .post('/posts/post-1/view')
      .expect(201)
      .expect({
        postId: 'post-1',
        viewCount: 1,
      });

    await request(app.getHttpServer())
      .get('/posts/post-1/comments')
      .expect(200)
      .expect({
        items: [],
        hasMore: false,
        nextCursor: null,
        commentsCount: 0,
      });

    const commentResponse = await request(app.getHttpServer())
      .post('/posts/post-1/comments')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Primeiro comentário' })
      .expect(201);

    expect(commentResponse.body).toEqual({
      comment: {
        id: 'comment-1',
        content: 'Primeiro comentário',
        createdAt: '2026-01-01T00:00:03.000Z',
        updatedAt: '2026-01-01T00:00:03.000Z',
        postId: 'post-1',
        parentCommentId: null,
        repliesCount: 0,
        author: {
          id: 'user-1',
          email: 'writer@eureca.local',
          name: null,
          username: null,
        },
      },
      commentsCount: 1,
    });

    await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([]);

    await request(app.getHttpServer())
      .get('/posts')
      .expect(200)
      .expect([
        {
          id: 'post-1',
          content: 'Meu primeiro post',
          createdAt: '2026-01-01T00:00:01.000Z',
          viewCount: 1,
          likesCount: 0,
          commentsCount: 1,
          viewerLiked: false,
          author: {
            id: 'user-1',
            email: 'writer@eureca.local',
            name: null,
            username: null,
          },
        },
      ]);

    const otherRegisterResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'other@eureca.local', password: 'dev123456' })
      .expect(201);

    const otherRegisterBody: unknown = otherRegisterResponse.body;
    expect(isAuthResponseBody(otherRegisterBody)).toBe(true);

    if (!isAuthResponseBody(otherRegisterBody)) {
      throw new Error('Invalid register response');
    }

    await request(app.getHttpServer())
      .patch('/comments/comment-1')
      .set('Authorization', `Bearer ${otherRegisterBody.access_token}`)
      .send({ content: 'Tentando editar' })
      .expect(403);

    const replyResponse = await request(app.getHttpServer())
      .post('/posts/post-1/comments')
      .set('Authorization', `Bearer ${otherRegisterBody.access_token}`)
      .send({
        content: 'Resposta de outro usuário',
        parentCommentId: 'comment-1',
      })
      .expect(201);

    expect(replyResponse.body).toMatchObject({
      comment: {
        id: 'comment-2',
        content: 'Resposta de outro usuário',
        postId: 'post-1',
        parentCommentId: 'comment-1',
        repliesCount: 0,
        author: {
          id: 'user-2',
          email: 'other@eureca.local',
        },
      },
      commentsCount: 2,
    });

    await request(app.getHttpServer())
      .get('/posts/post-1/comments')
      .query({ limit: 1 })
      .expect(200)
      .expect({
        items: [
          {
            id: 'comment-1',
            content: 'Primeiro comentário',
            createdAt: '2026-01-01T00:00:03.000Z',
            updatedAt: '2026-01-01T00:00:03.000Z',
            postId: 'post-1',
            parentCommentId: null,
            repliesCount: 1,
            author: {
              id: 'user-1',
              email: 'writer@eureca.local',
              name: null,
              username: null,
            },
          },
        ],
        hasMore: false,
        nextCursor: null,
        commentsCount: 2,
      });

    await request(app.getHttpServer())
      .get('/posts/post-1/comments')
      .query({ parentCommentId: 'comment-1', limit: 1 })
      .expect(200)
      .expect({
        items: [
          {
            id: 'comment-2',
            content: 'Resposta de outro usuário',
            createdAt: '2026-01-01T00:00:05.000Z',
            updatedAt: '2026-01-01T00:00:05.000Z',
            postId: 'post-1',
            parentCommentId: 'comment-1',
            repliesCount: 0,
            author: {
              id: 'user-2',
              email: 'other@eureca.local',
              name: null,
              username: null,
            },
          },
        ],
        hasMore: false,
        nextCursor: null,
        commentsCount: 2,
      });

    const notificationsResponse = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(notificationsResponse.body).toHaveLength(1);
    expect(notificationsResponse.body[0]).toMatchObject({
      id: 'notification-1',
      type: 'comment_reply',
      readAt: null,
      createdAt: '2026-01-01T00:00:06.000Z',
      postId: 'post-1',
      commentId: 'comment-2',
      actor: {
        id: 'user-2',
        email: 'other@eureca.local',
        name: null,
        username: null,
      },
      post: {
        id: 'post-1',
        content: 'Meu primeiro post',
      },
      comment: {
        id: 'comment-2',
        content: 'Resposta de outro usuário',
        parentCommentId: 'comment-1',
      },
    });

    const readNotificationResponse = await request(app.getHttpServer())
      .patch('/notifications/notification-1/read')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(readNotificationResponse.body).toMatchObject({
      id: 'notification-1',
      type: 'comment_reply',
      postId: 'post-1',
      commentId: 'comment-2',
    });
    expect(typeof readNotificationResponse.body.readAt).toBe('string');

    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ updatedCount: 0 });

    await request(app.getHttpServer())
      .delete('/comments/comment-2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({
        commentId: 'comment-2',
        postId: 'post-1',
        deleted: true,
        commentsCount: 1,
      });

    await request(app.getHttpServer())
      .patch('/comments/comment-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Comentário editado' })
      .expect(200)
      .expect({
        id: 'comment-1',
        content: 'Comentário editado',
        createdAt: '2026-01-01T00:00:03.000Z',
        updatedAt: '2026-01-01T00:00:07.000Z',
        postId: 'post-1',
        parentCommentId: null,
        repliesCount: 0,
        author: {
          id: 'user-1',
          email: 'writer@eureca.local',
          name: null,
          username: null,
        },
      });

    await request(app.getHttpServer())
      .get('/posts/post-1/comments')
      .expect(200)
      .expect({
        items: [
          {
            id: 'comment-1',
            content: 'Comentário editado',
            createdAt: '2026-01-01T00:00:03.000Z',
            updatedAt: '2026-01-01T00:00:07.000Z',
            postId: 'post-1',
            parentCommentId: null,
            repliesCount: 0,
            author: {
              id: 'user-1',
              email: 'writer@eureca.local',
              name: null,
              username: null,
            },
          },
        ],
        hasMore: false,
        nextCursor: null,
        commentsCount: 1,
      });

    await request(app.getHttpServer())
      .delete('/comments/comment-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({
        commentId: 'comment-1',
        postId: 'post-1',
        deleted: true,
        commentsCount: 0,
      });

    await request(app.getHttpServer())
      .get('/posts/post-1/comments')
      .expect(200)
      .expect({
        items: [],
        hasMore: false,
        nextCursor: null,
        commentsCount: 0,
      });

    await request(app.getHttpServer())
      .get('/posts')
      .expect(200)
      .expect([
        {
          id: 'post-1',
          content: 'Meu primeiro post',
          createdAt: '2026-01-01T00:00:01.000Z',
          viewCount: 1,
          likesCount: 0,
          commentsCount: 0,
          viewerLiked: false,
          author: {
            id: 'user-1',
            email: 'writer@eureca.local',
            name: null,
            username: null,
          },
        },
      ]);
  });

  it('paginates comment threads and protects notification ownership', async () => {
    const postAuthor = await registerTestUser(app, 'author@eureca.local');

    const postResponse = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${postAuthor.access_token}`)
      .send({ content: 'Post com conversa longa' })
      .expect(201);

    expect(postResponse.body).toMatchObject({
      id: 'post-1',
      content: 'Post com conversa longa',
      commentsCount: 0,
      author: {
        id: postAuthor.user.id,
        email: 'author@eureca.local',
      },
    });

    const commenter = await registerTestUser(app, 'commenter@eureca.local');
    const replier = await registerTestUser(app, 'replier@eureca.local');

    await request(app.getHttpServer())
      .post('/posts/post-1/comments')
      .set('Authorization', `Bearer ${commenter.access_token}`)
      .send({ content: 'Comentário raiz 1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/posts/post-1/comments')
      .set('Authorization', `Bearer ${commenter.access_token}`)
      .send({ content: 'Comentário raiz 2' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/posts/post-1/comments')
      .set('Authorization', `Bearer ${commenter.access_token}`)
      .send({ content: 'Comentário raiz 3' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/posts/post-1/comments')
      .set('Authorization', `Bearer ${replier.access_token}`)
      .send({
        content: 'Resposta ao primeiro comentário',
        parentCommentId: 'comment-1',
      })
      .expect(201);

    const firstPageResponse = await request(app.getHttpServer())
      .get('/posts/post-1/comments')
      .query({ limit: 2 })
      .expect(200);

    expect(firstPageResponse.body).toMatchObject({
      hasMore: true,
      nextCursor: 'comment-2',
      commentsCount: 4,
    });
    expect(firstPageResponse.body.items).toEqual([
      expect.objectContaining({
        id: 'comment-1',
        content: 'Comentário raiz 1',
        parentCommentId: null,
        repliesCount: 1,
      }),
      expect.objectContaining({
        id: 'comment-2',
        content: 'Comentário raiz 2',
        parentCommentId: null,
        repliesCount: 0,
      }),
    ]);

    const secondPageResponse = await request(app.getHttpServer())
      .get('/posts/post-1/comments')
      .query({ limit: 2, cursor: 'comment-2' })
      .expect(200);

    expect(secondPageResponse.body).toMatchObject({
      hasMore: false,
      nextCursor: null,
      commentsCount: 4,
    });
    expect(secondPageResponse.body.items).toEqual([
      expect.objectContaining({
        id: 'comment-3',
        content: 'Comentário raiz 3',
        parentCommentId: null,
        repliesCount: 0,
      }),
    ]);

    await request(app.getHttpServer())
      .get('/posts/post-1/comments')
      .query({ parentCommentId: 'comment-1', limit: 1 })
      .expect(200)
      .expect({
        items: [
          {
            id: 'comment-4',
            content: 'Resposta ao primeiro comentário',
            createdAt: '2026-01-01T00:00:10.000Z',
            updatedAt: '2026-01-01T00:00:10.000Z',
            postId: 'post-1',
            parentCommentId: 'comment-1',
            repliesCount: 0,
            author: {
              id: replier.user.id,
              email: 'replier@eureca.local',
              name: null,
              username: null,
            },
          },
        ],
        hasMore: false,
        nextCursor: null,
        commentsCount: 4,
      });

    await request(app.getHttpServer())
      .get('/posts/post-1/comments')
      .query({ parentCommentId: 'comment-1', cursor: 'comment-2' })
      .expect(400);

    const commenterNotificationsResponse = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${commenter.access_token}`)
      .expect(200);

    expect(commenterNotificationsResponse.body).toHaveLength(1);
    expect(commenterNotificationsResponse.body[0]).toMatchObject({
      id: 'notification-4',
      type: 'comment_reply',
      readAt: null,
      postId: 'post-1',
      commentId: 'comment-4',
      actor: {
        id: replier.user.id,
        email: 'replier@eureca.local',
      },
    });

    await request(app.getHttpServer())
      .patch('/notifications/notification-4/read')
      .set('Authorization', `Bearer ${replier.access_token}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch('/notifications/notification-4/read')
      .set('Authorization', `Bearer ${commenter.access_token}`)
      .expect(200);

    const authorNotificationsResponse = await request(app.getHttpServer())
      .get('/notifications')
      .set('Authorization', `Bearer ${postAuthor.access_token}`)
      .expect(200);

    expect(authorNotificationsResponse.body).toHaveLength(4);
    expect(authorNotificationsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'notification-1',
          type: 'post_comment',
          commentId: 'comment-1',
        }),
        expect.objectContaining({
          id: 'notification-2',
          type: 'post_comment',
          commentId: 'comment-2',
        }),
        expect.objectContaining({
          id: 'notification-3',
          type: 'post_comment',
          commentId: 'comment-3',
        }),
        expect.objectContaining({
          id: 'notification-5',
          type: 'post_comment',
          commentId: 'comment-4',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${postAuthor.access_token}`)
      .expect(200)
      .expect({ updatedCount: 4 });
  });
});
