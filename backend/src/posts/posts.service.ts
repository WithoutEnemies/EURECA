import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly topicKeywords = [
    { term: 'design', title: 'Design', category: 'Design' },
    { term: 'figma', title: 'Figma', category: 'Design' },
    { term: 'programacao', title: 'Programação', category: 'Programming' },
    { term: 'programação', title: 'Programação', category: 'Programming' },
    { term: 'codigo', title: 'Código', category: 'Programming' },
    { term: 'código', title: 'Código', category: 'Programming' },
    { term: 'react', title: 'React', category: 'Technology' },
    { term: 'rust', title: 'Rust', category: 'Programming' },
    { term: 'startup', title: 'Startup', category: 'Business' },
    { term: 'produto', title: 'Produto', category: 'Product' },
    { term: 'pesquisa', title: 'Pesquisa', category: 'Research' },
    { term: 'eureca', title: 'EURECA', category: 'Comunidade' },
  ] as const;

  // Monta a lista de campos que sera buscada no banco.
  // Se houver um usuario visualizando, tambem verifica se ele ja curtiu o post.
  private buildPostSelect(viewerId?: string) {
    return {
      id: true,
      content: true,
      imageUrl: true,
      createdAt: true,
      viewCount: true,
      author: {
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          role: true,
          eurecaPlusPlan: true,
          eurecaPlusSince: true,
        },
      },
      _count: { select: { likes: true, comments: true } },
      ...(viewerId
        ? {
            likes: {
              where: { userId: viewerId },
              select: { id: true },
              take: 1,
            },
          }
        : {}),
    } as const;
  }

  // Converte a resposta "crua" do banco em um formato mais amigavel para a API.
  private mapPost(post: {
    id: string;
    content: string;
    imageUrl?: string | null;
    createdAt: Date;
    viewCount: number;
    author: {
      id: string;
      email: string;
      name?: string | null;
      username?: string | null;
      role?: string | null;
      eurecaPlusPlan?: string | null;
      eurecaPlusSince?: Date | null;
    };
    _count: { likes: number; comments: number };
    likes?: Array<{ id: string }>;
  }) {
    return {
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl ?? null,
      createdAt: post.createdAt,
      viewCount: post.viewCount,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      viewerLiked: Array.isArray(post.likes) ? post.likes.length > 0 : false,
      author: post.author,
    };
  }

  // Cria um post novo associado ao autor informado.
  async create(authorId: string, content: string, imageUrl?: string | null) {
    const normalizedImageUrl = imageUrl?.trim() || null;
    const created = await this.prisma.post.create({
      data: { content, authorId, imageUrl: normalizedImageUrl },
      select: this.buildPostSelect(authorId),
    });
    return this.mapPost(created);
  }

  // Busca os posts mais recentes.
  // O "limit" controla quantos itens voltam, e "viewerId" personaliza a resposta para quem esta vendo.
  async findLatest(limit = 20, viewerId?: string) {
    const rows = await this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: this.buildPostSelect(viewerId),
    });
    return rows.map((post) => this.mapPost(post));
  }

  async findFollowingFeed(viewerId: string, limit = 20) {
    const rows = await this.prisma.post.findMany({
      where: {
        author: {
          is: {
            followers: {
              some: { followerId: viewerId },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: this.buildPostSelect(viewerId),
    });

    return rows.map((post) => this.mapPost(post));
  }

  async findTrends(limit = 4) {
    const rows = await this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        content: true,
        createdAt: true,
        viewCount: true,
        _count: { select: { likes: true, comments: true } },
      },
    });

    const topics = new Map<
      string,
      {
        title: string;
        category: string;
        postsCount: number;
        score: number;
        latestAt: Date;
      }
    >();

    rows.forEach((post) => {
      const content = post.content ?? '';
      const lowerContent = content.toLowerCase();
      const found = new Map<string, { title: string; category: string }>();

      for (const match of content.matchAll(/#[\p{L}\p{N}_-]+/gu)) {
        const title = match[0];
        found.set(title.toLowerCase(), { title, category: 'Trending' });
      }

      this.topicKeywords.forEach((keyword) => {
        if (lowerContent.includes(keyword.term)) {
          found.set(keyword.title.toLowerCase(), {
            title: keyword.title,
            category: keyword.category,
          });
        }
      });

      found.forEach((topic, key) => {
        const current = topics.get(key);
        const engagement =
          Number(post._count?.comments ?? 0) * 6 +
          Number(post._count?.likes ?? 0) * 3 +
          Number(post.viewCount ?? 0);

        if (current) {
          current.postsCount += 1;
          current.score += engagement + 1;
          if (post.createdAt > current.latestAt) {
            current.latestAt = post.createdAt;
          }
          return;
        }

        topics.set(key, {
          ...topic,
          postsCount: 1,
          score: engagement + 1,
          latestAt: post.createdAt,
        });
      });
    });

    return [...topics.values()]
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return right.latestAt.getTime() - left.latestAt.getTime();
      })
      .slice(0, limit)
      .map((topic) => ({
        category: topic.category,
        title: topic.title.startsWith('#') ? topic.title : `#${topic.title}`,
        postsCount: topic.postsCount,
        score: topic.score,
      }));
  }

  async deletePost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });

    if (!post) {
      throw new NotFoundException('Post não encontrado.');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('Você não pode apagar este post.');
    }

    await this.prisma.post.delete({
      where: { id: postId },
    });

    return { postId };
  }

  async reportPost(postId: string, reporterId: string, reason?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });

    if (!post) {
      throw new NotFoundException('Post não encontrado.');
    }

    if (post.authorId === reporterId) {
      throw new ForbiddenException('Você não pode denunciar seu próprio post.');
    }

    const normalizedReason = reason?.trim().slice(0, 500) || null;

    const report = await this.prisma.postReport.upsert({
      where: { postId_reporterId: { postId, reporterId } },
      update: { reason: normalizedReason },
      create: { postId, reporterId, reason: normalizedReason },
      select: { id: true, postId: true, reason: true, createdAt: true },
    });

    return { report };
  }

  // Garante que o post existe e registra a curtida.
  // O "upsert" evita duplicar a mesma curtida para o mesmo usuario.
  async like(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
    });

    if (!post) {
      throw new NotFoundException('Post não encontrado.');
    }

    const existingLike = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { id: true },
    });

    await this.prisma.postLike.upsert({
      where: { postId_userId: { postId, userId } },
      update: {},
      create: { postId, userId },
    });

    if (!existingLike && post.authorId !== userId) {
      await this.notifications.notifyPostLiked({ postId, actorId: userId });
    }

    return this.getPostReactionState(postId, userId);
  }

  // Remove a curtida, se ela existir, e devolve o novo estado da reacao.
  async unlike(postId: string, userId: string) {
    await this.prisma.postLike.deleteMany({
      where: { postId, userId },
    });

    return this.getPostReactionState(postId, userId);
  }

  // Incrementa o contador de visualizacoes diretamente no banco.
  async addView(postId: string) {
    const post = await this.prisma.post.update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
      select: { id: true, viewCount: true },
    });

    return { postId: post.id, viewCount: post.viewCount };
  }

  // Consulta em uma unica transacao:
  // 1. quantas curtidas o post possui,
  // 2. se o usuario atual curtiu esse post.
  // Isso garante uma resposta consistente.
  private async getPostReactionState(postId: string, userId: string) {
    const [likesCount, viewerLike] = await this.prisma.$transaction([
      this.prisma.postLike.count({ where: { postId } }),
      this.prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId } },
        select: { id: true },
      }),
    ]);

    return {
      postId,
      likesCount,
      viewerLiked: Boolean(viewerLike),
    };
  }
}
