import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { ArmedMode } from '../enums/armed-mode.enum';
import { DeviceEventType } from '../enums/device-event-type.enum';
import { SENSOR_ID_MIN, SENSOR_ID_MAX } from '../sensor.constants';

export class ArmedPayloadDto {
  @IsEnum(ArmedMode, {
    message: `mode must be one of ${Object.values(ArmedMode).join(', ')}`,
  })
  readonly mode!: ArmedMode;

  // Assumption: user_id is a positive integer (the spec only shows 3).
  @IsInt()
  @Min(1)
  readonly user_id!: number;
}

export class DisarmedPayloadDto {
  // Assumption: user_id is a positive integer (the spec only shows 3).
  @IsInt()
  @Min(1)
  readonly user_id!: number;
}

export class SensorPayloadDto {
  @IsInt()
  @Min(SENSOR_ID_MIN)
  @Max(SENSOR_ID_MAX)
  readonly sensor_id!: number;
}

// Telemetry the service doesn't act on, so values are stored as sent with no
// range check: rejecting a heartbeat over an odd reading would skip the
// last_seen_at update and show a live panel as offline.
export class HeartbeatPayloadDto {
  @IsInt()
  readonly battery_pct!: number;

  // Received Signal Strength Indicator
  @IsInt()
  readonly rssi_dbm!: number;
}

export type EventPayload =
  ArmedPayloadDto | DisarmedPayloadDto | SensorPayloadDto | HeartbeatPayloadDto;

export function getPayloadClass(type: DeviceEventType | undefined) {
  switch (type) {
    case DeviceEventType.ARMED:
      return ArmedPayloadDto;
    case DeviceEventType.DISARMED:
      return DisarmedPayloadDto;
    case DeviceEventType.SENSOR_OPENED:
    case DeviceEventType.SENSOR_CLOSED:
      return SensorPayloadDto;
    case DeviceEventType.HEARTBEAT:
      return HeartbeatPayloadDto;
    default:
      return class {};
  }
}
