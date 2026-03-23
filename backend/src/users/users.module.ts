import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  // Este modulo organiza tudo o que pertence ao assunto "usuarios".
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
