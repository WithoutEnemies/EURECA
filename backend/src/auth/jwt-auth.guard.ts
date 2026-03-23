import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// Guard e uma "barreira" antes da rota.
// Aqui, ela so libera o acesso se houver um token JWT valido.
export class JwtAuthGuard extends AuthGuard('jwt') {}
