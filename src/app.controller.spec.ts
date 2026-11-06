import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Database } from './database/database';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      // The liveness check never touches the database; readiness is covered in e2e.
      providers: [AppService, { provide: Database, useValue: {} }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return "ok"', () => {
      expect(appController.checkLiveness()).toBe('ok');
    });
  });
});
