import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Database } from './../src/database/database';
import { createApp } from './create-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createApp();
  });

  it('/health (GET) needs no X-Device-Token', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect('ok');
  });

  it('/health/ready (GET) reports ok when Postgres is reachable', () => {
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('connects to Postgres', async () => {
    const result = await app
      .get(Database)
      .pool.query<{ ok: number }>('SELECT 1 AS ok');

    expect(result.rows).toEqual([{ ok: 1 }]);
  });

  afterEach(async () => {
    await app.close();
  });
});
