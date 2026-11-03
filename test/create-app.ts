import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

export const DEVICE_TOKEN = 'test-device-token';

export async function createApp(): Promise<INestApplication<App>> {
  process.env.DEVICE_TOKEN = DEVICE_TOKEN;
  process.env.DATABASE_URL ??=
    'postgres://ingest:ingest@localhost:5433/device_events';

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}
