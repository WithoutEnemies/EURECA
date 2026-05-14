import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadsModule } from './uploads/uploads.module';
import { ConversationsModule } from './conversations/conversations.module';

@Module({
  // "imports" conecta os modulos principais da aplicacao.
  // Cada modulo agrupa um assunto do sistema, como autenticacao ou posts.
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PostsModule,
    CommentsModule,
    NotificationsModule,
    UploadsModule,
    ConversationsModule,
  ],
  // "controllers" recebem as requisicoes HTTP.
  controllers: [AppController],
  // "providers" concentram servicos reutilizaveis e regras de negocio.
  providers: [AppService],
})
export class AppModule {}
