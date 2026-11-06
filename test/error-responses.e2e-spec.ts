import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createApp, DEVICE_TOKEN } from './create-app';

describe('Error responses (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers a missing X-Device-Token with 401 and the error body', async () => {
    const response = await request(app.getHttpServer()).get('/devices');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: true,
      message: 'Missing or wrong X-Device-Token',
    });
  });

  it('answers an unknown route with 404 and the error body', async () => {
    const response = await request(app.getHttpServer())
      .get('/no-such-route')
      .set('X-Device-Token', DEVICE_TOKEN);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: true,
      message: 'Cannot GET /no-such-route',
    });
  });

  it('answers an invalid body with 400 and every failed rule in one message', async () => {
    const response = await request(app.getHttpServer())
      .post('/devices/panel-0042/events')
      .set('X-Device-Token', DEVICE_TOKEN)
      .send({
        event_id: 'abc',
        type: 'exploded',
        occurred_at: '2026-09-29T14:02:00Z',
        payload: {},
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: true,
      message:
        'event_id must be a UUID; type must be one of armed, disarmed, sensor_opened, sensor_closed, heartbeat',
    });
  });

  it('answers malformed JSON with 400 and the error body', async () => {
    const response = await request(app.getHttpServer())
      .post('/devices/panel-0042/events')
      .set('X-Device-Token', DEVICE_TOKEN)
      .set('Content-Type', 'application/json')
      .send('{"event_id": ');

    expect(response.status).toBe(400);
    // The wording comes from Node's JSON parser and changes between versions.
    expect(response.body).toEqual({ error: true, message: expect.any(String) });
  });
});
