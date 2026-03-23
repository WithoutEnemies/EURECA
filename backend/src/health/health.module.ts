import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  // Modulo simples para expor uma rota de verificacao do sistema.
  controllers: [HealthController],
})
export class HealthModule {}
