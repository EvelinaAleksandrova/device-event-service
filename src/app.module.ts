import { Module, ValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { DeviceTokenGuard } from './auth/device-token.guard';
import { ConfigModule } from '@nestjs/config';
import { DevicesModule } from './devices/devices.module';
import { AllExceptionsFilter } from './shared/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    DevicesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: DeviceTokenGuard },
    // Registered here rather than in main.ts so e2e tests built from AppModule get them too.
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
