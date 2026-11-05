import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Database } from './../src/database/database';
import { Clock } from './../src/shared/clock';
import { createApp, DEVICE_TOKEN } from './create-app';

const DEVICE_ID = 'panel-0042';

// Server time the test sets, so status changes need no real waiting.
class FakeClock extends Clock {
  private current = new Date('2026-09-29T14:00:00Z');

  now(): Date {
    return this.current;
  }

  set(isoTime: string) {
    this.current = new Date(isoTime);
  }
}

function newEvent(type: string, payload: object, eventId = randomUUID()) {
  return {
    event_id: eventId,
    type,
    occurred_at: '2026-09-29T14:00:00Z',
    payload,
  };
}

const heartbeat = () =>
  newEvent('heartbeat', { battery_pct: 87, rssi_dbm: -71 });

describe('GET /devices (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;
  let clock: FakeClock;

  beforeEach(async () => {
    clock = new FakeClock();
    app = await createApp(clock);
    db = app.get(Database);
    await db.pool.query('TRUNCATE device_events, devices');
  });

  afterEach(async () => {
    await app.close();
  });

  function postEvent(body: object, deviceId = DEVICE_ID) {
    return request(app.getHttpServer())
      .post(`/devices/${deviceId}/events`)
      .set('X-Device-Token', DEVICE_TOKEN)
      .send(body);
  }

  function getDevice(deviceId = DEVICE_ID) {
    return request(app.getHttpServer())
      .get(`/devices/${deviceId}`)
      .set('X-Device-Token', DEVICE_TOKEN);
  }

  function listDevices(query: string) {
    return request(app.getHttpServer())
      .get(`/devices${query}`)
      .set('X-Device-Token', DEVICE_TOKEN);
  }

  function postAt(isoTime: string, body: object, deviceId = DEVICE_ID) {
    clock.set(isoTime);
    return postEvent(body, deviceId);
  }

  it('follows the worked example from the spec', async () => {
    const sensor4Opened = newEvent('sensor_opened', { sensor_id: 4 });
    const armedState = {
      device_id: DEVICE_ID,
      arm_state: 'armed',
      arm_mode: 'away',
      open_sensors: [4],
      last_seen_at: '2026-09-29T14:02:00Z',
    };

    await postAt(
      '2026-09-29T14:00:00Z',
      newEvent('armed', { mode: 'away', user_id: 3 }),
    ).expect(201);
    await postAt('2026-09-29T14:01:00Z', heartbeat()).expect(201);
    await postAt('2026-09-29T14:02:00Z', sensor4Opened).expect(201);
    await postAt('2026-09-29T14:02:05Z', sensor4Opened).expect(200);

    clock.set('2026-09-29T14:06:30Z');
    const at1406 = await getDevice().expect(200);
    expect(at1406.body).toEqual({ ...armedState, status: 'online' });

    clock.set('2026-09-29T14:07:30Z');
    const at1407 = await getDevice().expect(200);
    expect(at1407.body).toEqual({ ...armedState, status: 'offline' });
    const offline = await listDevices('?status=offline').expect(200);
    expect(offline.body).toEqual({
      devices: [
        {
          device_id: DEVICE_ID,
          status: 'offline',
          last_seen_at: '2026-09-29T14:02:00Z',
        },
      ],
    });

    await postAt('2026-09-29T14:08:00Z', heartbeat()).expect(201);
    const at1408 = await getDevice().expect(200);
    expect(at1408.body).toEqual({
      ...armedState,
      status: 'online',
      last_seen_at: '2026-09-29T14:08:00Z',
    });

    const stored = await db.pool.query('SELECT 1 FROM device_events');
    expect(stored.rowCount).toBe(4);
  });

  describe('GET /devices/:id', () => {
    it('returns the state of a new device', async () => {
      await postAt(
        '2026-09-29T14:00:00.250Z',
        newEvent('sensor_opened', { sensor_id: 7 }),
      ).expect(201);

      const response = await getDevice();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        device_id: DEVICE_ID,
        status: 'online',
        last_seen_at: '2026-09-29T14:00:00.250Z',
        arm_state: 'disarmed',
        arm_mode: null,
        open_sensors: [7],
      });
    });

    it('is online exactly 5 minutes after last seen and offline 1 ms later', async () => {
      await postAt('2026-09-29T14:00:00Z', heartbeat()).expect(201);

      clock.set('2026-09-29T14:05:00Z');
      expect((await getDevice()).body.status).toBe('online');

      clock.set('2026-09-29T14:05:00.001Z');
      expect((await getDevice()).body.status).toBe('offline');
    });

    it('returns 404 for a device that has never sent an event', async () => {
      const response = await getDevice('panel-unknown');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: true,
        message: 'Device panel-unknown not found',
      });
    });

    it('returns 404 for a device whose only event was invalid', async () => {
      await postEvent(newEvent('sensor_opened', { sensor_id: 65 })).expect(400);

      await getDevice().expect(404);
    });

    it('rejects a request without X-Device-Token', () => {
      return request(app.getHttpServer())
        .get(`/devices/${DEVICE_ID}`)
        .expect(401);
    });
  });

  describe('GET /devices', () => {
    // panel-a and panel-c are last seen 5 minutes or less ago, panel-b longer.
    beforeEach(async () => {
      await postAt('2026-09-29T14:00:00Z', heartbeat(), 'panel-b').expect(201);
      await postAt('2026-09-29T14:02:00Z', heartbeat(), 'panel-c').expect(201);
      await postAt('2026-09-29T14:06:00Z', heartbeat(), 'panel-a').expect(201);
      clock.set('2026-09-29T14:07:00Z');
    });

    it('lists the online devices sorted by id', async () => {
      const response = await listDevices('?status=online');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        devices: [
          {
            device_id: 'panel-a',
            status: 'online',
            last_seen_at: '2026-09-29T14:06:00Z',
          },
          {
            device_id: 'panel-c',
            status: 'online',
            last_seen_at: '2026-09-29T14:02:00Z',
          },
        ],
      });
    });

    it('lists the offline devices', async () => {
      const response = await listDevices('?status=offline');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        devices: [
          {
            device_id: 'panel-b',
            status: 'offline',
            last_seen_at: '2026-09-29T14:00:00Z',
          },
        ],
      });
    });

    it('moves a device to offline once more than 5 minutes have passed', async () => {
      clock.set('2026-09-29T14:07:00.001Z');

      const response = await listDevices('?status=offline');

      expect(
        response.body.devices.map(
          (device: { device_id: string }) => device.device_id,
        ),
      ).toEqual(['panel-b', 'panel-c']);
    });

    it('lists every device with its own status when status is missing', async () => {
      const response = await listDevices('');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        devices: [
          {
            device_id: 'panel-a',
            status: 'online',
            last_seen_at: '2026-09-29T14:06:00Z',
          },
          {
            device_id: 'panel-b',
            status: 'offline',
            last_seen_at: '2026-09-29T14:00:00Z',
          },
          {
            device_id: 'panel-c',
            status: 'online',
            last_seen_at: '2026-09-29T14:02:00Z',
          },
        ],
      });
    });

    it('returns an empty list when no device matches', async () => {
      clock.set('2026-09-29T15:00:00Z');

      const response = await listDevices('?status=online');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ devices: [] });
    });

    it.each([
      ['an unknown status', '?status=sleeping'],
      ['an uppercase status', '?status=OFFLINE'],
      ['an empty status', '?status='],
      ['a repeated status', '?status=online&status=offline'],
    ])('rejects %s with 400', async (_case, query) => {
      const response = await listDevices(query);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: true,
        message: 'status must be one of online, offline',
      });
    });
  });
});
