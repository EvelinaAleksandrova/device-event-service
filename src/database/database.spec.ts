import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Database } from './database';

describe('Database', () => {
  it('fails to start when DATABASE_URL is not configured', async () => {
    const moduleRef = Test.createTestingModule({
      providers: [
        Database,
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    });

    await expect(moduleRef.compile()).rejects.toThrow(
      'DATABASE_URL environment variable is not set',
    );
  });
});
