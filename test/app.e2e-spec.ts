import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Database } from './../src/database/database';
import { createApp, DEVICE_TOKEN } from './create-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createApp();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .set('X-Device-Token', DEVICE_TOKEN)
      .expect(200)
      .expect('Hello World!');
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
