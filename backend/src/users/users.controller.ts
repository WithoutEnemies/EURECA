import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

type RequestUser = {
  userId: string;
  email: string;
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Rota protegida que devolve os dados basicos do usuario autenticado.
  // O req.user e preenchido pela estrategia JWT depois que o token e validado.
  // Depois disso, a resposta final vem do banco para manter o contrato consistente.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user?: RequestUser }) {
    const userId = req.user?.userId ?? '';
    const user = await this.usersService.findMe(userId);
    return { user };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/eureca-plus')
  async activatePlus(
    @Req() req: { user?: RequestUser },
    @Body() body: { plan?: string },
  ) {
    const userId = req.user?.userId ?? '';
    const user = await this.usersService.activateEurecaPlus(
      userId,
      body.plan ?? '',
    );
    return { user };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/eureca-plus')
  async cancelPlus(@Req() req: { user?: RequestUser }) {
    const userId = req.user?.userId ?? '';
    const user = await this.usersService.cancelEurecaPlus(userId);
    return { user };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/suggestions')
  async suggestions(@Req() req: { user?: RequestUser }) {
    const userId = req.user?.userId ?? '';
    return this.usersService.findFollowSuggestions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  async follow(@Req() req: { user?: RequestUser }, @Param('id') id: string) {
    const userId = req.user?.userId ?? '';
    return this.usersService.followUser(userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  async unfollow(@Req() req: { user?: RequestUser }, @Param('id') id: string) {
    const userId = req.user?.userId ?? '';
    return this.usersService.unfollowUser(userId, id);
  }

  @Get(':id/followers')
  async followers(@Param('id') id: string) {
    return this.usersService.findFollowers(id);
  }

  @Get(':id/following')
  async following(@Param('id') id: string) {
    return this.usersService.findFollowing(id);
  }

  // Rota publica para visualizar o perfil seguro de outro usuario.
  @Get(':id')
  async publicProfile(@Param('id') id: string) {
    const user = await this.usersService.findPublicProfile(id);
    return { user };
  }
}
