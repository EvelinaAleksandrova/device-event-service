import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  checkLiveness(): string {
    return this.appService.checkLiveness();
  }

  @Get('health/ready')
  checkReadiness(): Promise<{ status: string }> {
    return this.appService.checkReadiness();
  }
}
