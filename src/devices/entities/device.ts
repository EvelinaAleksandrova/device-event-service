import { ArmState } from '../enums/arm-state.enum';
import { ArmedMode } from '../enums/armed-mode.enum';

export interface Device {
  id: string;
  last_seen_at: Date;
  arm_state: ArmState;
  arm_mode: ArmedMode | null;
  open_sensors: number[];
}

export type DeviceState = Pick<
  Device,
  'arm_state' | 'arm_mode' | 'open_sensors'
>;
