import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { Database } from '../database/database';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      // The liveness check never touches the database; readiness is covered in e2e.
      providers: [HealthService, { provide: Database, useValue: {} }],
    }).compile();

    healthController = module.get<HealthController>(HealthController);
  });

  describe('health', () => {
    it('should return "ok"', () => {
      expect(healthController.checkLiveness()).toBe('ok');
    });
  });
});
