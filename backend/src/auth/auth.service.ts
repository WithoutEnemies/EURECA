import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private readonly safeUserSelect = {
    id: true,
    email: true,
    name: true,
    username: true,
    role: true,
    bio: true,
    interests: true,
    eurecaPlusPlan: true,
    eurecaPlusSince: true,
    createdAt: true,
  } as const;

  private buildProfileData(dto: RegisterDto) {
    const username = this.normalizeUsername(dto.username);

    return {
      name: dto.name?.trim() || null,
      username: username || null,
      role: dto.role?.trim() || null,
      bio: dto.bio?.trim() || null,
      interests: Array.isArray(dto.interests)
        ? dto.interests
            .map((interest) => interest.trim())
            .filter(Boolean)
            .slice(0, 12)
        : [],
    };
  }

  private normalizeUsername(value?: string) {
    return value?.trim().replace(/^@+/, '').toLowerCase();
  }

  // Fluxo de cadastro:
  // 1. limpa e normaliza os dados,
  // 2. garante que email e senha existem,
  // 3. impede email duplicado,
  // 4. salva a senha de forma protegida,
  // 5. devolve um token para o usuario ja entrar autenticado.
  async register(dto: RegisterDto) {
    const email = dto.email?.trim().toLowerCase();
    const password = dto.password;

    if (!email || !password) {
      throw new BadRequestException('Email e password são obrigatórios.');
    }

    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new BadRequestException('Este email já está em uso.');
    }

    const profileData = this.buildProfileData(dto);
    if (profileData.username) {
      const usernameExists = await this.prisma.user.findUnique({
        where: { username: profileData.username },
      });

      if (usernameExists) {
        throw new BadRequestException('Este nome de usuário já está em uso.');
      }
    }

    // A senha nunca e salva "em texto puro".
    // O bcrypt transforma a senha em um hash dificil de reverter.
    const passwordHash = await bcrypt.hash(password, 10);

    // Cria o usuario no banco e retorna apenas campos seguros.
    // O hash da senha fica guardado no banco, mas nao volta para o cliente.
    const user = await this.prisma.user.create({
      data: { email, password: passwordHash, ...profileData },
      select: this.safeUserSelect,
    });

    // Gera o token que identifica o usuario nas proximas requisicoes.
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { user, access_token: token };
  }

  // Fluxo de login:
  // 1. normaliza os dados recebidos,
  // 2. procura o usuario pelo email ou nome de usuario,
  // 3. compara a senha enviada com a senha protegida no banco,
  // 4. devolve um token se estiver tudo certo.
  async login(dto: LoginDto) {
    const identifier = dto.email?.trim().toLowerCase();
    const password = dto.password;

    if (!identifier || !password) {
      throw new BadRequestException(
        'Email/usuário e password são obrigatórios.',
      );
    }

    const shouldSearchByUsername =
      identifier.startsWith('@') || !identifier.includes('@');

    const user = shouldSearchByUsername
      ? await this.prisma.user.findUnique({
          where: { username: this.normalizeUsername(identifier) },
        })
      : await this.prisma.user.findUnique({ where: { email: identifier } });

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // "compare" verifica a senha informada sem expor a senha real armazenada.
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // O token carrega informacoes minimas para reconhecer quem fez login.
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        role: user.role,
        bio: user.bio,
        interests: user.interests,
        eurecaPlusPlan: user.eurecaPlusPlan,
        eurecaPlusSince: user.eurecaPlusSince,
        createdAt: user.createdAt,
      },
    };
  }
}
