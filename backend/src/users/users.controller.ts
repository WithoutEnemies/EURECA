import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type RequestUser = {
  userId: string;
  email: string;
};

@Controller('users')
export class UsersController {
  // Rota protegida que devolve os dados basicos do usuario autenticado.
  // O req.user e preenchido pela estrategia JWT depois que o token e validado.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user?: RequestUser }) {
    return { user: req.user ?? null };
  }
}
