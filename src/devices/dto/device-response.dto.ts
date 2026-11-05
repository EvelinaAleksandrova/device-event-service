import { toIsoUtc } from '../../shared/date-formatter';
import { Device } from '../entities/device';
import { ArmState } from '../enums/arm-state.enum';
import { ArmedMode } from '../enums/armed-mode.enum';
import { DeviceStatus } from '../enums/device-status.enum';

// What GET /devices/:id returns: the stored state plus the status at read time.
export class DeviceResponseDto {
  readonly device_id: string;
  readonly status: DeviceStatus;
  readonly last_seen_at: string;
  readonly arm_state: ArmState;
  readonly arm_mode: ArmedMode | null;
  readonly open_sensors: number[];

  constructor(device: Device, status: DeviceStatus) {
    this.device_id = device.id;
    this.status = status;
    this.last_seen_at = toIsoUtc(device.last_seen_at);
    this.arm_state = device.arm_state;
    this.arm_mode = device.arm_mode;
    this.open_sensors = device.open_sensors;
  }
}
