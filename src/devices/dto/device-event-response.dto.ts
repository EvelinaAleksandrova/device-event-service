import { toIsoUtc } from '../../shared/date-formatter';
import { DeviceEvent } from '../entities/device-event';
import { DeviceEventType } from '../enums/device-event-type.enum';
import { EventPayload } from './payload.dto';

// What the API returns for an event; only the fields listed here leave the service.
export class DeviceEventResponseDto {
  readonly device_id: string;
  readonly event_id: string;
  readonly type: DeviceEventType;
  readonly occurred_at: string;
  readonly payload: EventPayload;

  constructor(row: DeviceEvent) {
    this.device_id = row.device_id;
    this.event_id = row.event_id;
    this.type = row.type;
    this.occurred_at = toIsoUtc(row.occurred_at);
    this.payload = row.payload;
  }
}
