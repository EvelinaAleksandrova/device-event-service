import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DatabaseModule } from '../database/database.module';
import { Clock } from '../shared/clock';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [DatabaseModule, MetricsModule],
  controllers: [DevicesController],
  providers: [DevicesService, Clock],
})
export class DevicesModule {}
