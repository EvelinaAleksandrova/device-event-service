import { IsEnum, IsOptional } from 'class-validator';
import { DeviceStatus } from '../enums/device-status.enum';

export class ListDevicesQueryDto {
  // Only a missing status is optional: an empty or repeated one is still
  // validated, so it gets 400 as an unknown status filter.
  @IsOptional()
  @IsEnum(DeviceStatus, {
    message: `status must be one of ${Object.values(DeviceStatus).join(', ')}`,
  })
  readonly status?: DeviceStatus;
}
