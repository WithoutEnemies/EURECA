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
  author: {
    id: string;
    email: string;
    name?: string | null;
    username?: string | null;
  };
};

type CommentOwnerRow = {
  id: string;
  postId: string;
  authorId: string;
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
    author: { select: { id: true, email: true, name: true, username: true } },
  } as const;

  private mapComment(comment: CommentRow) {
    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      postId: comment.postId,
      parentCommentId: comment.parentCommentId,
      author: comment.author,
    };
  }

  // Lista os comentarios de um post em ordem cronologica.
  async findForPost(postId: string) {
    await this.assertPostExists(postId);

    const rows = await this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: this.commentSelect,
    });

    return rows.map((comment) => this.mapComment(comment));
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
}
