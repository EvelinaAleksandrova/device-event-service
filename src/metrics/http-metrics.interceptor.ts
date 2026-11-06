import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { Clock } from '../shared/clock';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly clock: Clock,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    // The pattern, e.g. /devices/:id/events: one label value per device id would grow without limit.
    const route = (request.route as { path: string }).path;
    // Scrapes would skew the latency of the real API.
    if (route === '/metrics') {
      return next.handle();
    }

    const start = this.clock.now();
    // On 'finish' the status code is final, including errors set later by the exception filter.
    response.once('finish', () => {
      const seconds = (this.clock.now().getTime() - start.getTime()) / 1000;
      this.metricsService.recordRequest(
        request.method,
        route,
        response.statusCode,
        seconds,
      );
    });
    return next.handle();
  }
}
