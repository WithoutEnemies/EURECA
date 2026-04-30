import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type CommentRow = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  postId: string;
  parentCommentId?: string | null;
  _count?: {
    replies: number;
  };
  author: {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
    role?: string | null;
  };
};

type CommentOwnerRow = {
  id: string;
  postId: string;
  authorId: string;
};

type FindCommentsOptions = {
  parentCommentId?: string;
  cursor?: string;
  limit?: string | number;
};

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly commentSelect = {
    id: true,
    content: true,
    createdAt: true,
    updatedAt: true,
    postId: true,
    parentCommentId: true,
    _count: { select: { replies: true } },
    author: {
      select: { id: true, email: true, name: true, username: true, role: true },
    },
  } as const;

  private readonly defaultPageSize = 10;
  private readonly maxPageSize = 25;

  private mapComment(comment: CommentRow) {
    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      postId: comment.postId,
      parentCommentId: comment.parentCommentId,
      repliesCount: comment._count?.replies ?? 0,
      author: comment.author,
    };
  }

  // Lista comentarios em paginas pequenas. Por padrao, busca comentarios raiz;
  // quando parentCommentId vem preenchido, busca somente respostas daquele comentario.
  async findForPost(postId: string, options: FindCommentsOptions = {}) {
    await this.assertPostExists(postId);
    await this.assertValidParentComment(postId, options.parentCommentId);

    const limit = this.normalizeLimit(options.limit);
    const parentCommentId = options.parentCommentId ?? null;
    const cursorComment = await this.findPaginationCursor(
      postId,
      parentCommentId,
      options.cursor,
    );

    const rows = await this.prisma.comment.findMany({
      where: {
        postId,
        parentCommentId,
        ...(cursorComment
          ? {
              OR: [
                { createdAt: { gt: cursorComment.createdAt } },
                {
                  createdAt: cursorComment.createdAt,
                  id: { gt: cursorComment.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      select: this.commentSelect,
    });
    const commentsCount = await this.countForPost(postId);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = pageRows.at(-1);

    return {
      items: pageRows.map((comment) => this.mapComment(comment)),
      hasMore,
      nextCursor: hasMore && lastRow ? lastRow.id : null,
      commentsCount,
    };
  }

  // Cria um comentario no post informado em nome do usuario autenticado.
  async create(
    postId: string,
    authorId: string,
    content: string,
    parentCommentId?: string,
  ) {
    await this.assertPostExists(postId);
    await this.assertValidParentComment(postId, parentCommentId);

    const created = await this.prisma.comment.create({
      data: { postId, authorId, content, parentCommentId },
      select: this.commentSelect,
    });
    const commentsCount = await this.countForPost(postId);
    await this.notifications.notifyCommentCreated({
      postId,
      commentId: created.id,
      actorId: authorId,
      parentCommentId: created.parentCommentId,
    });

    return {
      comment: this.mapComment(created),
      commentsCount,
    };
  }

  // Edita apenas comentarios criados pelo proprio usuario.
  async update(commentId: string, userId: string, content: string) {
    await this.assertCommentAuthor(commentId, userId);

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
      select: this.commentSelect,
    });

    return this.mapComment(updated);
  }

  // Remove comentarios criados pelo proprio usuario ou recebidos em um post proprio.
  async remove(commentId: string, userId: string) {
    const comment = await this.assertCanRemoveComment(commentId, userId);

    await this.prisma.comment.delete({
      where: { id: commentId },
    });
    const commentsCount = await this.countForPost(comment.postId);

    return {
      commentId,
      postId: comment.postId,
      deleted: true,
      commentsCount,
    };
  }

  private async assertPostExists(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException('Post não encontrado.');
    }
  }

  private async assertValidParentComment(
    postId: string,
    parentCommentId?: string,
  ) {
    if (!parentCommentId) {
      return;
    }

    const parent = await this.prisma.comment.findUnique({
      where: { id: parentCommentId },
      select: { id: true, postId: true },
    });

    if (!parent) {
      throw new NotFoundException('Comentário pai não encontrado.');
    }

    if (parent.postId !== postId) {
      throw new BadRequestException(
        'A resposta precisa pertencer ao mesmo post do comentário pai.',
      );
    }
  }

  private async assertCommentAuthor(
    commentId: string,
    userId: string,
  ): Promise<CommentOwnerRow> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true },
    });

    if (!comment) {
      throw new NotFoundException('Comentário não encontrado.');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('Você não pode alterar este comentário.');
    }

    return comment;
  }

  private async assertCanRemoveComment(
    commentId: string,
    userId: string,
  ): Promise<CommentOwnerRow> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true },
    });

    if (!comment) {
      throw new NotFoundException('Comentário não encontrado.');
    }

    if (comment.authorId === userId) {
      return comment;
    }

    const post = await this.prisma.post.findUnique({
      where: { id: comment.postId },
      select: { authorId: true },
    });

    if (post?.authorId === userId) {
      return comment;
    }

    throw new ForbiddenException('Você não pode alterar este comentário.');
  }

  private countForPost(postId: string) {
    return this.prisma.comment.count({
      where: { postId },
    });
  }

  private normalizeLimit(limit?: string | number) {
    const parsed = Number(limit ?? this.defaultPageSize);

    if (!Number.isFinite(parsed)) {
      return this.defaultPageSize;
    }

    return Math.min(this.maxPageSize, Math.max(1, Math.floor(parsed)));
  }

  private async findPaginationCursor(
    postId: string,
    parentCommentId: string | null,
    cursor?: string,
  ) {
    if (!cursor) {
      return null;
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id: cursor },
      select: {
        id: true,
        postId: true,
        parentCommentId: true,
        createdAt: true,
      },
    });

    if (!comment) {
      throw new BadRequestException('Cursor de comentários inválido.');
    }

    if (
      comment.postId !== postId ||
      (comment.parentCommentId ?? null) !== parentCommentId
    ) {
      throw new BadRequestException('Cursor de comentários inválido.');
    }

    return comment;
  }
}
