import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

type RequestUser = {
  userId: string;
  email: string;
};

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  // Lista os comentarios de um post. Esta rota e publica como o feed.
  @Get('posts/:postId/comments')
  findForPost(@Param('postId') postId: string) {
    return this.comments.findForPost(postId);
  }

  // Cria um comentario em nome do usuario autenticado.
  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/comments')
  create(
    @Param('postId') postId: string,
    @Req() req: { user?: RequestUser },
    @Body() dto: CreateCommentDto,
  ) {
    const userId = req.user?.userId ?? '';
    return this.comments.create(
      postId,
      userId,
      dto.content,
      dto.parentCommentId,
    );
  }

  // Edita um comentario proprio.
  @UseGuards(JwtAuthGuard)
  @Patch('comments/:id')
  update(
    @Param('id') id: string,
    @Req() req: { user?: RequestUser },
    @Body() dto: UpdateCommentDto,
  ) {
    const userId = req.user?.userId ?? '';
    return this.comments.update(id, userId, dto.content);
  }

  // Apaga um comentario proprio.
  @UseGuards(JwtAuthGuard)
  @Delete('comments/:id')
  remove(@Param('id') id: string, @Req() req: { user?: RequestUser }) {
    const userId = req.user?.userId ?? '';
    return this.comments.remove(id, userId);
  }
}
