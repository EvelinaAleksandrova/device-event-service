import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Database } from './../src/database/database';
import { createApp, DEVICE_TOKEN } from './create-app';

const sensorOpened = {
  event_id: '7c1e9a52-3b0f-4d8e-9a61-2f4b8c0d1e77',
  type: 'sensor_opened',
  occurred_at: '2026-09-29T14:02:00Z',
  payload: { sensor_id: 4 },
};

describe('GET /metrics (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createApp();
    await app.get(Database).pool.query('TRUNCATE device_events, devices');
  });

  afterEach(async () => {
    await app.close();
  });

  function postEvent(body: object) {
    return request(app.getHttpServer())
      .post('/devices/panel-0042/events')
      .set('X-Device-Token', DEVICE_TOKEN)
      .send(body);
  }

  async function getMetrics(): Promise<string> {
    const response = await request(app.getHttpServer())
      .get('/metrics')
      .expect(200);
    return response.text;
  }

  it('answers without X-Device-Token in the Prometheus text format', async () => {
    const response = await request(app.getHttpServer())
      .get('/metrics')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.text).toContain('# TYPE events_ingested_total counter');
  });

  it('counts the same event sent twice as created once and duplicate once', async () => {
    await postEvent(sensorOpened).expect(201);
    await postEvent(sensorOpened).expect(200);

    const metrics = await getMetrics();

    expect(metrics).toContain(
      'events_ingested_total{result="created",type="sensor_opened"} 1',
    );
    expect(metrics).toContain(
      'events_ingested_total{result="duplicate",type="sensor_opened"} 1',
    );
  });

  it('records request duration under the route pattern, not the device id', async () => {
    await request(app.getHttpServer())
      .get('/devices/panel-0042')
      .set('X-Device-Token', DEVICE_TOKEN)
      .expect(404);

    const metrics = await getMetrics();

    expect(metrics).toContain(
      'http_request_duration_seconds_count{method="GET",route="/devices/:id",status_code="404"} 1',
    );
    expect(metrics).not.toContain('panel-0042');
  });

  it('leaves /metrics itself out of the request durations', async () => {
    await getMetrics();

    expect(await getMetrics()).not.toContain('route="/metrics"');
  });
});
