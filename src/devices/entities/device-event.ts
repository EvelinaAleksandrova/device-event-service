import type { EventPayload } from '../dto/payload.dto';
import { DeviceEventType } from '../enums/device-event-type.enum';

// A device_events row as the service reads it back.
export interface DeviceEvent {
  device_id: string;
  event_id: string;
  type: DeviceEventType;
  occurred_at: Date;
  payload: EventPayload;
}
