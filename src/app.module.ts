import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { APP_GUARD } from '@nestjs/core';
import { DeviceTokenGuard } from './auth/device-token.guard';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: DeviceTokenGuard }],
})
export class AppModule {}
