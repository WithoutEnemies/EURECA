import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // Devolve uma mensagem fixa.
  // Em muitos projetos, esse arquivo vira um exemplo inicial e depois perde importancia.
  getHello(): string {
    return 'Hello World!';
  }
}
