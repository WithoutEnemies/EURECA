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
      .expect([]);

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
        author: {
          id: 'user-2',
          email: 'other@eureca.local',
        },
      },
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
      .expect([
        {
          id: 'comment-1',
          content: 'Comentário editado',
          createdAt: '2026-01-01T00:00:03.000Z',
          updatedAt: '2026-01-01T00:00:07.000Z',
          postId: 'post-1',
          parentCommentId: null,
          author: {
            id: 'user-1',
            email: 'writer@eureca.local',
            name: null,
            username: null,
          },
        },
      ]);

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
});
