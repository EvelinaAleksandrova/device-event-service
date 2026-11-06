import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createApp, DEVICE_TOKEN } from './create-app';

describe('X-Device-Token (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lets a request with the right X-Device-Token through', () => {
    return request(app.getHttpServer())
      .get('/devices')
      .set('X-Device-Token', DEVICE_TOKEN)
      .expect(200);
  });

  it('rejects a request without X-Device-Token', () => {
    return request(app.getHttpServer()).get('/devices').expect(401);
  });

  it('rejects a request with a wrong X-Device-Token', () => {
    return request(app.getHttpServer())
      .get('/devices')
      .set('X-Device-Token', 'wrong-token')
      .expect(401);
  });
});
