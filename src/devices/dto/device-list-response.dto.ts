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

  constructor(devices: { device: DeviceSummary; status: DeviceStatus }[]) {
    this.devices = devices.map(
      ({ device, status }) => new DeviceSummaryResponseDto(device, status),
    );
  }
}
