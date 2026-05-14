import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly publicUserSelect = {
    id: true,
    email: true,
    name: true,
    username: true,
    role: true,
    bio: true,
    interests: true,
    eurecaPlusPlan: true,
    eurecaPlusSince: true,
    createdAt: true,
    _count: { select: { posts: true, followers: true, following: true } },
  } as const;

  private mapPublicUser(user: {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
    role?: string | null;
    bio?: string | null;
    interests?: string[];
    eurecaPlusPlan?: string | null;
    eurecaPlusSince?: Date | null;
    createdAt: Date;
    _count?: { posts?: number; followers?: number; following?: number };
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      bio: user.bio,
      interests: user.interests ?? [],
      eurecaPlusPlan: user.eurecaPlusPlan,
      eurecaPlusSince: user.eurecaPlusSince,
      createdAt: user.createdAt,
      postsCount: Number(user._count?.posts ?? 0),
      followersCount: Number(user._count?.followers ?? 0),
      followingCount: Number(user._count?.following ?? 0),
    };
  }

  private mapSuggestion(user: {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
    role?: string | null;
    bio?: string | null;
    interests?: string[];
    createdAt: Date;
    _count?: { posts?: number; followers?: number };
    followers?: Array<{ followerId: string }>;
  }) {
    const postsCount = Number(user._count?.posts ?? 0);
    const followersCount = Number(user._count?.followers ?? 0);
    const primaryInterest = user.interests?.[0] ?? user.role ?? 'Comunidade';

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      bio: user.bio,
      interests: user.interests ?? [],
      createdAt: user.createdAt,
      postsCount,
      followersCount,
      viewerFollowing: Boolean(user.followers?.length),
      reason:
        postsCount > 0
          ? `${postsCount} ${postsCount === 1 ? 'post' : 'posts'} publicados`
          : `Interesse em ${primaryInterest}`,
    };
  }

  // Busca o usuario autenticado direto no banco para devolver o mesmo formato
  // usado nas respostas de login e cadastro.
  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.publicUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    return this.mapPublicUser(user);
  }

  async activateEurecaPlus(userId: string, plan: string) {
    const allowedPlans = new Set(['monthly', 'quarterly', 'annual']);
    if (!allowedPlans.has(plan)) {
      throw new NotFoundException('Plano EURECA+ não encontrado.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { eurecaPlusSince: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        eurecaPlusPlan: plan,
        eurecaPlusSince: existing.eurecaPlusSince ?? new Date(),
      },
      select: this.publicUserSelect,
    });

    return this.mapPublicUser(updated);
  }

  async cancelEurecaPlus(userId: string) {
    if (!userId) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        eurecaPlusPlan: null,
        eurecaPlusSince: null,
      },
      select: this.publicUserSelect,
    });

    return this.mapPublicUser(updated);
  }

  async findFollowSuggestions(userId: string, limit = 6) {
    if (!userId) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!currentUser) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const users = await this.prisma.user.findMany({
      where: { id: { not: userId } },
      orderBy: [{ posts: { _count: 'desc' } }, { createdAt: 'desc' }],
      take: limit,
      select: {
        ...this.publicUserSelect,
        _count: { select: { posts: true, followers: true } },
        followers: {
          where: { followerId: userId },
          select: { followerId: true },
          take: 1,
        },
      },
    });

    return users.map((user) => this.mapSuggestion(user));
  }

  async followUser(followerId: string, followingId: string) {
    if (!followerId) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    if (followerId === followingId) {
      throw new BadRequestException('Você não pode seguir a si mesmo.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true },
    });

    if (!target) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    await this.prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { followerId, followingId },
    });

    return this.getFollowState(followerId, followingId);
  }

  async unfollowUser(followerId: string, followingId: string) {
    if (!followerId) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    await this.prisma.userFollow.deleteMany({
      where: { followerId, followingId },
    });

    return this.getFollowState(followerId, followingId);
  }

  // Perfil publico de outro usuario. Nao devolve senha nem qualquer dado sensivel.
  async findPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return this.mapPublicUser(user);
  }

  async findFollowers(userId: string) {
    await this.ensureUserExists(userId);

    const rows = await this.prisma.userFollow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        createdAt: true,
        follower: { select: this.publicUserSelect },
      },
    });

    return rows.map((row) => ({
      followedAt: row.createdAt,
      user: this.mapPublicUser(row.follower),
    }));
  }

  async findFollowing(userId: string) {
    await this.ensureUserExists(userId);

    const rows = await this.prisma.userFollow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        createdAt: true,
        following: { select: this.publicUserSelect },
      },
    });

    return rows.map((row) => ({
      followedAt: row.createdAt,
      user: this.mapPublicUser(row.following),
    }));
  }

  private async getFollowState(followerId: string, followingId: string) {
    const [followersCount, viewerFollow] = await this.prisma.$transaction([
      this.prisma.userFollow.count({ where: { followingId } }),
      this.prisma.userFollow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
        select: { followerId: true },
      }),
    ]);

    return {
      userId: followingId,
      followersCount,
      viewerFollowing: Boolean(viewerFollow),
    };
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
  }
}
