import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Database } from './../src/database/database';
import { DEVICE_TOKEN } from './create-app';

// A real pool pointed at a port where nothing listens, so the connection is
// refused just as when Postgres is stopped. Database itself can't be used here:
// it checks the connection on startup and the app would not boot.
describe('GET /health/ready with Postgres down (e2e)', () => {
  let app: INestApplication<App>;
  let unreachablePool: Pool;

  beforeEach(async () => {
    process.env.DEVICE_TOKEN = DEVICE_TOKEN;
    unreachablePool = new Pool({
      connectionString: 'postgres://ingest:ingest@127.0.0.1:1/device_events',
    });

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(Database)
      .useValue({ pool: unreachablePool })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    await unreachablePool.end();
  });

  it('answers 503 with the error body', () => {
    return request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect({ error: true, message: 'Database unavailable' });
  });

  it('still answers /health with 200, since liveness ignores the database', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect('ok');
  });
});
