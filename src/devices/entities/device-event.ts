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

// A row as the history API reads it. pg returns BIGINT as a string.
export type HistoryEvent = Pick<
  DeviceEvent,
  'event_id' | 'type' | 'occurred_at' | 'payload'
> & { seq: string };
