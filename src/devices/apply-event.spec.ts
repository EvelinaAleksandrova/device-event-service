import { applyEvent } from './apply-event';
import { DeviceEventDto } from './dto/device-event.dto';
import { EventPayload } from './dto/payload.dto';
import { DeviceState } from './entities/device';
import { ArmState } from './enums/arm-state.enum';
import { ArmedMode } from './enums/armed-mode.enum';
import { DeviceEventType } from './enums/device-event-type.enum';

const DISARMED: DeviceState = {
  arm_state: ArmState.DISARMED,
  arm_mode: null,
  open_sensors: [],
};

function eventOf(type: DeviceEventType, payload: EventPayload): DeviceEventDto {
  return {
    event_id: '7c1e9a52-3b0f-4d8e-9a61-2f4b8c0d1e77',
    type,
    occurred_at: '2026-09-29T14:02:00Z',
    payload,
  };
}

const armed = (mode: ArmedMode) =>
  eventOf(DeviceEventType.ARMED, { mode, user_id: 3 });
const disarmed = () => eventOf(DeviceEventType.DISARMED, { user_id: 3 });
const sensorOpened = (sensor_id: number) =>
  eventOf(DeviceEventType.SENSOR_OPENED, { sensor_id });
const sensorClosed = (sensor_id: number) =>
  eventOf(DeviceEventType.SENSOR_CLOSED, { sensor_id });
const heartbeat = () =>
  eventOf(DeviceEventType.HEARTBEAT, { battery_pct: 87, rssi_dbm: -71 });

describe('applyEvent', () => {
  describe('armed', () => {
    it('arms the panel with the given mode', () => {
      expect(applyEvent(DISARMED, armed(ArmedMode.AWAY))).toEqual({
        arm_state: ArmState.ARMED,
        arm_mode: ArmedMode.AWAY,
        open_sensors: [],
      });
    });

    it('switches the mode when the panel is already armed', () => {
      const armedStay = applyEvent(DISARMED, armed(ArmedMode.STAY));

      expect(applyEvent(armedStay, armed(ArmedMode.AWAY)).arm_mode).toBe(
        ArmedMode.AWAY,
      );
    });

    it('keeps the open sensors', () => {
      const withOpenSensor = { ...DISARMED, open_sensors: [4] };

      expect(
        applyEvent(withOpenSensor, armed(ArmedMode.AWAY)).open_sensors,
      ).toEqual([4]);
    });
  });

  describe('disarmed', () => {
    it('disarms the panel and clears the mode', () => {
      const armedAway = applyEvent(DISARMED, armed(ArmedMode.AWAY));

      expect(applyEvent(armedAway, disarmed())).toEqual(DISARMED);
    });

    it('leaves an already disarmed panel disarmed', () => {
      expect(applyEvent(DISARMED, disarmed())).toEqual(DISARMED);
    });

    it('keeps the open sensors', () => {
      const armedWithOpenSensor = {
        arm_state: ArmState.ARMED,
        arm_mode: ArmedMode.STAY,
        open_sensors: [4, 7],
      };

      expect(applyEvent(armedWithOpenSensor, disarmed()).open_sensors).toEqual([
        4, 7,
      ]);
    });
  });

  describe('sensor_opened', () => {
    it('adds the sensor to the open sensors', () => {
      expect(applyEvent(DISARMED, sensorOpened(4)).open_sensors).toEqual([4]);
    });

    it('keeps the open sensors sorted ascending', () => {
      const withSensor7 = applyEvent(DISARMED, sensorOpened(7));

      expect(applyEvent(withSensor7, sensorOpened(4)).open_sensors).toEqual([
        4, 7,
      ]);
    });

    it('does not list a sensor twice when it is opened again', () => {
      const withSensor4 = applyEvent(DISARMED, sensorOpened(4));

      expect(applyEvent(withSensor4, sensorOpened(4)).open_sensors).toEqual([
        4,
      ]);
    });

    it('keeps the arm state', () => {
      const armedAway = applyEvent(DISARMED, armed(ArmedMode.AWAY));

      expect(applyEvent(armedAway, sensorOpened(4))).toEqual({
        arm_state: ArmState.ARMED,
        arm_mode: ArmedMode.AWAY,
        open_sensors: [4],
      });
    });
  });

  describe('sensor_closed', () => {
    it('removes the sensor from the open sensors', () => {
      const withSensors = { ...DISARMED, open_sensors: [4, 7] };

      expect(applyEvent(withSensors, sensorClosed(4)).open_sensors).toEqual([
        7,
      ]);
    });

    it('ignores a sensor that is not open', () => {
      const withSensor7 = { ...DISARMED, open_sensors: [7] };

      expect(applyEvent(withSensor7, sensorClosed(4)).open_sensors).toEqual([
        7,
      ]);
    });
  });

  describe('heartbeat', () => {
    it('leaves the state unchanged', () => {
      const state = {
        arm_state: ArmState.ARMED,
        arm_mode: ArmedMode.AWAY,
        open_sensors: [4],
      };

      expect(applyEvent(state, heartbeat())).toEqual(state);
    });
  });

  it('does not modify the state it is given', () => {
    const state = { ...DISARMED, open_sensors: [7] };

    applyEvent(state, sensorOpened(4));
    applyEvent(state, sensorClosed(7));
    applyEvent(state, armed(ArmedMode.AWAY));

    expect(state).toEqual({ ...DISARMED, open_sensors: [7] });
  });
});
