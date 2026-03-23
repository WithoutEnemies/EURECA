import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';

@Module({
  // Reune as rotas e a logica relacionadas aos posts.
  providers: [PostsService],
  controllers: [PostsController],
})
export class PostsModule {}
