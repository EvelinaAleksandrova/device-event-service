import { Controller, Get, Header } from '@nestjs/common';
import { Registry } from 'prom-client';
import { MetricsService } from './metrics.service';

// No token guard: Prometheus scrapes this and doesn't send a device token.
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', Registry.PROMETHEUS_CONTENT_TYPE)
  getMetrics(): Promise<string> {
    return this.metricsService.metrics();
  }
}
