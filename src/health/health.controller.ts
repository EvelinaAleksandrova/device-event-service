import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  checkLiveness(): string {
    return this.healthService.checkLiveness();
  }

  @Get('ready')
  checkReadiness(): Promise<{ status: string }> {
    return this.healthService.checkReadiness();
  }
}
