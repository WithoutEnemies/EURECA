import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly publicUserSelect = {
    id: true,
    email: true,
    name: true,
    username: true,
    role: true,
    bio: true,
    interests: true,
    createdAt: true,
  } as const;

  // Busca o usuario autenticado direto no banco para devolver o mesmo formato
  // usado nas respostas de login e cadastro.
  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.publicUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    return user;
  }

  // Perfil publico de outro usuario. Nao devolve senha nem qualquer dado sensivel.
  async findPublicProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return user;
  }
}
