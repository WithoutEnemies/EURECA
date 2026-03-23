import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly config: ConfigService) {
    const url = config.get<string>('DATABASE_URL');

    // Sem a URL do banco, o backend nao consegue consultar nem salvar dados.
    if (!url) {
      throw new Error('DATABASE_URL não definido no .env');
    }

    // Prisma 7 (engineType=client) exige adapter ou accelerateUrl
    const adapter = new PrismaPg({ connectionString: url });
    super({ adapter });
  }

  // Quando o modulo sobe, abre a conexao com o banco.
  async onModuleInit() {
    await this.$connect();
  }

  // Quando a aplicacao encerra, fecha a conexao para evitar recursos presos.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
