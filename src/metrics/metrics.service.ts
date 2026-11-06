import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService {
  // Own registry, not prom-client's global one: e2e tests start a new app per
  // test, and registering the same metric name twice on one registry throws.
  private readonly registry = new Registry();

  private readonly eventsIngested = new Counter({
    name: 'events_ingested_total',
    help: 'Device events received, by result (created or duplicate) and type.',
    labelNames: ['result', 'type'] as const,
    registers: [this.registry],
  });

  private readonly requestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  recordEventIngested(type: string, created: boolean): void {
    this.eventsIngested.inc({
      result: created ? 'created' : 'duplicate',
      type,
    });
  }

  recordRequest(
    method: string,
    route: string,
    statusCode: number,
    seconds: number,
  ): void {
    this.requestDuration.observe(
      { method, route, status_code: statusCode },
      seconds,
    );
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
