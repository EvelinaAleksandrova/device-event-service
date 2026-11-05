import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { Clock } from './../src/shared/clock';

export const DEVICE_TOKEN = 'test-device-token';

// Pass a clock to control server time; otherwise the app uses the real one.
export async function createApp(clock?: Clock): Promise<INestApplication<App>> {
  process.env.DEVICE_TOKEN = DEVICE_TOKEN;
  // Fixed here so a different value in a local .env can't change test results.
  process.env.OFFLINE_AFTER_SECONDS = '300';
  process.env.DATABASE_URL ??=
    'postgres://ingest:ingest@localhost:5433/device_events';

  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (clock) {
    builder.overrideProvider(Clock).useValue(clock);
  }
  const moduleFixture = await builder.compile();

  const app = moduleFixture.createNestApplication();
  await app.init();
  return app;
}
