import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  // Marca o cliente do banco como disponivel para toda a aplicacao.
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
