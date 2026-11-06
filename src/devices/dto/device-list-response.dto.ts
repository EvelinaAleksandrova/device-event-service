import { toIsoUtc } from '../../shared/date-formatter';
import { DeviceSummary } from '../entities/device';
import { DeviceStatus } from '../enums/device-status.enum';

export class DeviceSummaryResponseDto {
  readonly device_id: string;
  readonly status: DeviceStatus;
  readonly last_seen_at: string;

  constructor(device: DeviceSummary, status: DeviceStatus) {
    this.device_id = device.id;
    this.status = status;
    this.last_seen_at = toIsoUtc(device.last_seen_at);
  }
}

export class DeviceListResponseDto {
  readonly devices: DeviceSummaryResponseDto[];
  readonly next: string | null;

  constructor(
    devices: { device: DeviceSummary; status: DeviceStatus }[],
    next: string | null,
  ) {
    this.devices = devices.map(
      ({ device, status }) => new DeviceSummaryResponseDto(device, status),
    );
    this.next = next;
  }
}

// Relative, like the history next URL. status is repeated, or the next page
// would stop being filtered. The cursor is a device id, so it is escaped too.
export function nextDeviceListUrl(
  status: DeviceStatus | undefined,
  limit: number,
  cursor: string | null,
): string | null {
  if (cursor === null) {
    return null;
  }
  const query = new URLSearchParams();
  if (status !== undefined) {
    query.set('status', status);
  }
  query.set('limit', String(limit));
  query.set('cursor', cursor);
  return `/devices?${query.toString()}`;
}
