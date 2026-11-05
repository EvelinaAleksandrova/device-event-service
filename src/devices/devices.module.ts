import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DatabaseModule } from '../database/database.module';
import { Clock } from '../shared/clock';

@Module({
  imports: [DatabaseModule],
  controllers: [DevicesController],
  providers: [DevicesService, Clock],
})
export class DevicesModule {}
