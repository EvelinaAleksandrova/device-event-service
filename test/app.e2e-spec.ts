import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Database } from './../src/database/database';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.DATABASE_URL ??=
      'postgres://ingest:ingest@localhost:5433/device_events';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
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
