import {
  IsEnum,
  IsISO8601,
  IsObject,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeviceEventType } from '../enums/device-event-type.enum';
import { getPayloadClass, type EventPayload } from './payload.dto';
import { UTC_ISO_8601 } from '../../shared/utc-iso-8601';

export class DeviceEventDto {
  @IsUUID()
  readonly event_id!: string;

  @IsEnum(DeviceEventType, {
    message: `type must be one of ${Object.values(DeviceEventType).join(', ')}`,
  })
  readonly type!: DeviceEventType;

  // Device clock in UTC, e.g. 2026-09-29T14:02:00Z. strict rejects impossible
  // dates (Feb 30); the regex rejects date-only, week dates and non-UTC offsets.
  @IsISO8601({ strict: true })
  @Matches(UTC_ISO_8601, {
    message:
      'occurred_at must be a UTC ISO 8601 timestamp, e.g. 2026-09-29T14:02:00Z',
  })
  readonly occurred_at!: string;

  @IsObject()
  @ValidateNested()
  @Type((options) => {
    const { type } = (options?.object ?? {}) as Partial<DeviceEventDto>;
    return getPayloadClass(type);
  })
  readonly payload!: EventPayload;
}
