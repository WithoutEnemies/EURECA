import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';

type RequestUser = {
  userId: string;
  email: string;
};

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  // Cria um novo post em nome do usuario autenticado.
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: { user?: RequestUser }, @Body() dto: CreatePostDto) {
    const userId = req.user?.userId;
    return this.posts.create(userId ?? '', dto.content, dto.imageUrl);
  }

  // Lista os posts mais recentes para qualquer pessoa.
  @Get()
  findLatest() {
    return this.posts.findLatest();
  }

  // Lista o feed do usuario logado.
  // Aqui o backend tambem consegue informar se esse usuario curtiu cada post.
  @UseGuards(JwtAuthGuard)
  @Get('me/feed')
  findLatestForMe(@Req() req: { user?: RequestUser }) {
    const userId = req.user?.userId;
    return this.posts.findLatest(20, userId);
  }

  // Lista somente posts das contas que o usuario autenticado segue.
  @UseGuards(JwtAuthGuard)
  @Get('me/following')
  findFollowingFeed(@Req() req: { user?: RequestUser }) {
    const userId = req.user?.userId;
    return this.posts.findFollowingFeed(userId ?? '');
  }

  // Calcula topicos em alta a partir do conteudo real dos posts.
  @Get('trends')
  findTrends() {
    return this.posts.findTrends();
  }

  // Registra uma curtida do usuario autenticado em um post.
  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  like(@Param('id') id: string, @Req() req: { user?: RequestUser }) {
    const userId = req.user?.userId;
    return this.posts.like(id, userId ?? '');
  }

  // Remove a curtida do usuario autenticado.
  @UseGuards(JwtAuthGuard)
  @Delete(':id/like')
  unlike(@Param('id') id: string, @Req() req: { user?: RequestUser }) {
    const userId = req.user?.userId;
    return this.posts.unlike(id, userId ?? '');
  }

  // Apaga um post criado pelo usuario autenticado.
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  delete(@Param('id') id: string, @Req() req: { user?: RequestUser }) {
    const userId = req.user?.userId;
    return this.posts.deletePost(id, userId ?? '');
  }

  // Registra uma denuncia de post feita pelo usuario autenticado.
  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  report(
    @Param('id') id: string,
    @Req() req: { user?: RequestUser },
    @Body() body: { reason?: string },
  ) {
    const userId = req.user?.userId;
    return this.posts.reportPost(id, userId ?? '', body.reason);
  }

  // Soma uma visualizacao ao post.
  // Esta rota nao exige login.
  @Post(':id/view')
  addView(@Param('id') id: string) {
    return this.posts.addView(id);
  }
}
