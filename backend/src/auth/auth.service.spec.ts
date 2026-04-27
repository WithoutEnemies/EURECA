import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

type PrismaUserMock = {
  findUnique: jest.Mock;
  create: jest.Mock;
};

type JwtMock = {
  signAsync: jest.Mock;
};

describe('AuthService', () => {
  let service: AuthService;
  let prismaUser: PrismaUserMock;
  let jwt: JwtMock;
  const safeUserSelect = {
    id: true,
    email: true,
    name: true,
    username: true,
    role: true,
    bio: true,
    interests: true,
    createdAt: true,
  };

  beforeEach(() => {
    prismaUser = {
      findUnique: jest.fn(),
      create: jest.fn(),
    };

    jwt = {
      signAsync: jest.fn(),
    };

    service = new AuthService(
      { user: prismaUser } as unknown as PrismaService,
      jwt as unknown as JwtService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('register normalizes the email and returns only safe user fields', async () => {
    const createdAt = new Date('2026-02-01T12:00:00.000Z');

    prismaUser.findUnique.mockResolvedValue(null);
    prismaUser.create.mockResolvedValue({
      id: 'user-1',
      email: 'dev@eureca.local',
      name: 'Dev Eureca',
      username: 'dev_eureca',
      role: 'Desenvolvimento',
      bio: 'Criando uma comunidade.',
      interests: ['Frontend', 'Backend'],
      createdAt,
    });
    jwt.signAsync.mockResolvedValue('signed-token');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    const result = await service.register({
      email: '  DEV@EURECA.LOCAL ',
      password: 'dev123456',
      name: ' Dev Eureca ',
      username: ' @DEV_EURECA ',
      role: ' Desenvolvimento ',
      bio: ' Criando uma comunidade. ',
      interests: ['Frontend', 'Backend'],
    });

    expect(prismaUser.findUnique).toHaveBeenCalledWith({
      where: { email: 'dev@eureca.local' },
    });
    expect(prismaUser.findUnique).toHaveBeenCalledWith({
      where: { username: 'dev_eureca' },
    });
    expect(prismaUser.create).toHaveBeenCalledWith({
      data: {
        email: 'dev@eureca.local',
        password: 'hashed-password',
        name: 'Dev Eureca',
        username: 'dev_eureca',
        role: 'Desenvolvimento',
        bio: 'Criando uma comunidade.',
        interests: ['Frontend', 'Backend'],
      },
      select: safeUserSelect,
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'dev@eureca.local',
    });
    expect(result).toEqual({
      access_token: 'signed-token',
      user: {
        id: 'user-1',
        email: 'dev@eureca.local',
        name: 'Dev Eureca',
        username: 'dev_eureca',
        role: 'Desenvolvimento',
        bio: 'Criando uma comunidade.',
        interests: ['Frontend', 'Backend'],
        createdAt,
      },
    });
  });

  it('register rejects duplicate emails', async () => {
    prismaUser.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'dev@eureca.local',
      name: null,
      username: null,
      role: null,
      bio: null,
      interests: [],
    });

    await expect(
      service.register({
        email: 'dev@eureca.local',
        password: 'dev123456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('register rejects duplicate usernames', async () => {
    prismaUser.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-2', username: 'dev_eureca' });

    await expect(
      service.register({
        email: 'new@eureca.local',
        password: 'dev123456',
        username: 'dev_eureca',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaUser.create).not.toHaveBeenCalled();
  });

  it('login returns a token and the authenticated user data', async () => {
    const createdAt = new Date('2026-02-01T12:00:00.000Z');

    prismaUser.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'dev@eureca.local',
      password: 'hashed-password',
      name: 'Dev Eureca',
      username: 'dev_eureca',
      role: 'Desenvolvimento',
      bio: 'Criando uma comunidade.',
      interests: ['Frontend', 'Backend'],
      createdAt,
    });
    jwt.signAsync.mockResolvedValue('signed-token');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'DEV@EURECA.LOCAL',
      password: 'dev123456',
    });

    expect(prismaUser.findUnique).toHaveBeenCalledWith({
      where: { email: 'dev@eureca.local' },
    });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'dev@eureca.local',
    });
    expect(result).toEqual({
      access_token: 'signed-token',
      user: {
        id: 'user-1',
        email: 'dev@eureca.local',
        name: 'Dev Eureca',
        username: 'dev_eureca',
        role: 'Desenvolvimento',
        bio: 'Criando uma comunidade.',
        interests: ['Frontend', 'Backend'],
        createdAt,
      },
    });
  });

  it('login accepts the username as the identifier', async () => {
    const createdAt = new Date('2026-02-01T12:00:00.000Z');

    prismaUser.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'dev@eureca.local',
      password: 'hashed-password',
      name: 'Dev Eureca',
      username: 'dev_eureca',
      role: 'Desenvolvimento',
      bio: 'Criando uma comunidade.',
      interests: ['Frontend', 'Backend'],
      createdAt,
    });
    jwt.signAsync.mockResolvedValue('signed-token');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login({
        email: '@DEV_EURECA',
        password: 'dev123456',
      }),
    ).resolves.toMatchObject({
      access_token: 'signed-token',
      user: {
        id: 'user-1',
        email: 'dev@eureca.local',
        username: 'dev_eureca',
      },
    });

    expect(prismaUser.findUnique).toHaveBeenCalledWith({
      where: { username: 'dev_eureca' },
    });
  });

  it('login rejects invalid credentials', async () => {
    prismaUser.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'dev@eureca.local',
      password: 'hashed-password',
      name: null,
      username: null,
      role: null,
      bio: null,
      interests: [],
      createdAt: new Date('2026-02-01T12:00:00.000Z'),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'dev@eureca.local',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
