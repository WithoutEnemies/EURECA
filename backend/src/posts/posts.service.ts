import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  // Monta a lista de campos que sera buscada no banco.
  // Se houver um usuario visualizando, tambem verifica se ele ja curtiu o post.
  private buildPostSelect(viewerId?: string) {
    return {
      id: true,
      content: true,
      createdAt: true,
      viewCount: true,
      author: {
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          role: true,
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
    createdAt: Date;
    viewCount: number;
    author: {
      id: string;
      email: string;
      name?: string | null;
      username?: string | null;
      role?: string | null;
    };
    _count: { likes: number; comments: number };
    likes?: Array<{ id: string }>;
  }) {
    return {
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      viewCount: post.viewCount,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      viewerLiked: Array.isArray(post.likes) ? post.likes.length > 0 : false,
      author: post.author,
    };
  }

  // Cria um post novo associado ao autor informado.
  async create(authorId: string, content: string) {
    const created = await this.prisma.post.create({
      data: { content, authorId },
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

  // Garante que o post existe e registra a curtida.
  // O "upsert" evita duplicar a mesma curtida para o mesmo usuario.
  async like(postId: string, userId: string) {
    const exists = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Post não encontrado.');
    }

    await this.prisma.postLike.upsert({
      where: { postId_userId: { postId, userId } },
      update: {},
      create: { postId, userId },
    });

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
