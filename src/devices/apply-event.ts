import { DeviceEventDto } from './dto/device-event.dto';
import { ArmedPayloadDto, SensorPayloadDto } from './dto/payload.dto';
import { DeviceState } from './entities/device';
import { ArmState } from './enums/arm-state.enum';
import { DeviceEventType } from './enums/device-event-type.enum';

export function applyEvent(
  state: DeviceState,
  event: DeviceEventDto,
): DeviceState {
  switch (event.type) {
    case DeviceEventType.ARMED: {
      const { mode } = event.payload as ArmedPayloadDto;
      return { ...state, arm_state: ArmState.ARMED, arm_mode: mode };
    }
    case DeviceEventType.DISARMED:
      return { ...state, arm_state: ArmState.DISARMED, arm_mode: null };
    case DeviceEventType.SENSOR_OPENED: {
      const { sensor_id } = event.payload as SensorPayloadDto;
      if (state.open_sensors.includes(sensor_id)) return state;
      const open_sensors = [...state.open_sensors, sensor_id].sort(
        (a, b) => a - b,
      );
      return { ...state, open_sensors };
    }
    case DeviceEventType.SENSOR_CLOSED: {
      const { sensor_id } = event.payload as SensorPayloadDto;
      return {
        ...state,
        open_sensors: state.open_sensors.filter((id) => id !== sensor_id),
      };
    }
    case DeviceEventType.HEARTBEAT:
      return state; // a heartbeat updates last seen only
  }
}
