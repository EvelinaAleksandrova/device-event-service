import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { APP_GUARD } from '@nestjs/core';
import { DeviceTokenGuard } from './auth/device-token.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: DeviceTokenGuard }],
})
export class AppModule {}
