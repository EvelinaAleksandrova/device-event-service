import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('counts created and duplicate events separately, by type', async () => {
    service.recordEventIngested('armed', true);
    service.recordEventIngested('armed', false);
    service.recordEventIngested('armed', false);

    const metrics = await service.metrics();

    expect(metrics).toContain(
      'events_ingested_total{result="created",type="armed"} 1',
    );
    expect(metrics).toContain(
      'events_ingested_total{result="duplicate",type="armed"} 2',
    );
  });

  it('records request durations by method, route and status code', async () => {
    service.recordRequest('GET', '/devices/:id', 404, 0.02);

    const metrics = await service.metrics();

    expect(metrics).toContain(
      'http_request_duration_seconds_count{method="GET",route="/devices/:id",status_code="404"} 1',
    );
  });

  it('includes the default Node.js metrics', async () => {
    expect(await service.metrics()).toContain('process_cpu_user_seconds_total');
  });

  it('keeps each instance separate, so a new app starts from zero', async () => {
    service.recordEventIngested('armed', true);

    const metrics = await new MetricsService().metrics();

    expect(metrics).not.toContain('events_ingested_total{');
  });
});
