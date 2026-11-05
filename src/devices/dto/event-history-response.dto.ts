import { toIsoUtc } from '../../shared/date-formatter';
import { HistoryEvent } from '../entities/device-event';
import { DeviceEventType } from '../enums/device-event-type.enum';
import { EventPayload } from './payload.dto';

// seq stays internal; clients only see it inside the next URL.
export class HistoryEventResponseDto {
  readonly event_id: string;
  readonly type: DeviceEventType;
  readonly occurred_at: string;
  readonly payload: EventPayload;

  constructor(row: HistoryEvent) {
    this.event_id = row.event_id;
    this.type = row.type;
    this.occurred_at = toIsoUtc(row.occurred_at);
    this.payload = row.payload;
  }
}

export class EventHistoryResponseDto {
  readonly events: HistoryEventResponseDto[];
  readonly next: string | null;

  constructor(events: HistoryEvent[], next: string | null) {
    this.events = events.map((row) => new HistoryEventResponseDto(row));
    this.next = next;
  }
}

// Relative, so it doesn't depend on the Host header. since isn't repeated:
// every event after the cursor is at or after it anyway.
export function nextPageUrl(
  deviceId: string,
  limit: number,
  cursor: string | null,
): string | null {
  if (cursor === null) {
    return null;
  }
  const query = new URLSearchParams({ limit: String(limit), cursor });
  return `/devices/${encodeURIComponent(deviceId)}/events?${query.toString()}`;
}
