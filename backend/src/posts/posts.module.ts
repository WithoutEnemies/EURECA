import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';

@Module({
  // Reune as rotas e a logica relacionadas aos posts.
  imports: [NotificationsModule],
  providers: [PostsService],
  controllers: [PostsController],
})
export class PostsModule {}
