import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Rota basica usada como resposta simples da raiz da API.
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
