import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // Endpoint de "saude" usado para confirmar se a API esta online.
  @Get()
  check() {
    return {
      status: 'ok',
      time: new Date().toISOString(),
      version: '0.0.1',
    };
  }
}
