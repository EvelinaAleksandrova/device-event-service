import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DeviceStatus } from '../enums/device-status.enum';
import { IsIntegerString, MAX_LIMIT, toPageLimit } from './page-limit';

// Query values arrive as strings and the global ValidationPipe doesn't
// transform, so this class only validates; toListDevicesQuery converts limit.
export class ListDevicesQueryDto {
  // Only a missing status is optional: an empty or repeated one is still
  // validated, so it gets 400 as an unknown status filter.
  @IsOptional()
  @IsEnum(DeviceStatus, {
    message: `status must be one of ${Object.values(DeviceStatus).join(', ')}`,
  })
  readonly status?: DeviceStatus;

  @IsOptional()
  @IsIntegerString(1, MAX_LIMIT)
  readonly limit?: string;

  // Any device id is a valid position, even one no device has, so only an
  // empty or repeated cursor is a 400. Same message as the history cursor.
  @IsOptional()
  @IsString({ message: 'cursor is invalid' })
  @IsNotEmpty({ message: 'cursor is invalid' })
  readonly cursor?: string;
}

export interface ListDevicesQuery {
  status?: DeviceStatus;
  limit: number;
  // The id of the last device on the previous page.
  cursor?: string;
}

export function toListDevicesQuery(dto: ListDevicesQueryDto): ListDevicesQuery {
  return {
    status: dto.status,
    limit: toPageLimit(dto.limit),
    cursor: dto.cursor,
  };
}
