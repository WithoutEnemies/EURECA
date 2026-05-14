import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';

// Esta funcao e o ponto de partida do backend.
// Ela cria a aplicacao, aplica configuracoes globais e abre a porta HTTP.
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Libera chamadas do frontend local para este backend.
  // Sem isso, o navegador bloquearia requisicoes vindas de outra porta.
  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  });

  // Expoe imagens salvas localmente pelo endpoint de upload.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Valida automaticamente os dados recebidos nas rotas.
  // "whitelist" remove campos inesperados.
  // "forbidNonWhitelisted" rejeita a requisicao se vier algo fora do esperado.
  // "transform" converte os dados para o formato definido nos DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Inicia o servidor na porta definida no .env ou usa 3000 como padrao.
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
