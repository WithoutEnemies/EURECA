import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
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

  // Rota publica para visualizar o perfil seguro de outro usuario.
  @Get(':id')
  async publicProfile(@Param('id') id: string) {
    const user = await this.usersService.findPublicProfile(id);
    return { user };
  }
}
