import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Database } from './../src/database/database';
import { Device } from './../src/devices/entities/device';
import { createApp, DEVICE_TOKEN } from './create-app';

const DEVICE_ID = 'panel-0042';
const LONG_AGO = new Date('2000-01-01T00:00:00Z');

const sensorOpened = {
  event_id: '7c1e9a52-3b0f-4d8e-9a61-2f4b8c0d1e77',
  type: 'sensor_opened',
  occurred_at: '2026-09-29T14:02:00Z',
  payload: { sensor_id: 4 },
};

function newEvent(type: string, payload: object) {
  return {
    event_id: randomUUID(),
    type,
    occurred_at: '2026-09-29T14:02:00Z',
    payload,
  };
}

describe('POST /devices/:id/events (e2e)', () => {
  let app: INestApplication<App>;
  let db: Database;

  beforeEach(async () => {
    app = await createApp();
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

  async function countStoredEvents() {
    const result = await db.pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM device_events',
    );
    return result.rows[0].count;
  }

  async function readDevice() {
    const result = await db.pool.query<Device>(
      `SELECT id, last_seen_at, arm_state, arm_mode, open_sensors
       FROM devices WHERE id = $1`,
      [DEVICE_ID],
    );
    return result.rows[0];
  }

  // Moves last_seen_at to a known value, so a test can see whether a request changed it.
  async function setLastSeenAt(lastSeenAt: Date) {
    await db.pool.query('UPDATE devices SET last_seen_at = $2 WHERE id = $1', [
      DEVICE_ID,
      lastSeenAt,
    ]);
  }

  describe('a new event', () => {
    it('returns 201 with the stored event', async () => {
      const response = await postEvent(sensorOpened);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        device_id: DEVICE_ID,
        event_id: sensorOpened.event_id,
        type: 'sensor_opened',
        occurred_at: '2026-09-29T14:02:00Z',
        payload: { sensor_id: 4 },
      });
    });

    it('keeps milliseconds in occurred_at', async () => {
      const response = await postEvent({
        ...sensorOpened,
        occurred_at: '2026-09-29T14:02:00.250Z',
      });

      expect(response.body.occurred_at).toBe('2026-09-29T14:02:00.250Z');
    });

    it('creates the device on its first event', async () => {
      await postEvent(sensorOpened).expect(201);

      expect(await readDevice()).toEqual({
        id: DEVICE_ID,
        last_seen_at: expect.any(Date),
        arm_state: 'disarmed',
        arm_mode: null,
        open_sensors: [4],
      });
    });

    it('updates the device state with each event', async () => {
      await postEvent(newEvent('armed', { mode: 'away', user_id: 3 }));
      await postEvent(newEvent('sensor_opened', { sensor_id: 7 }));
      await postEvent(newEvent('sensor_opened', { sensor_id: 4 }));
      await postEvent(newEvent('sensor_closed', { sensor_id: 7 }));
      await postEvent(
        newEvent('heartbeat', { battery_pct: 87, rssi_dbm: -71 }),
      );

      expect(await readDevice()).toMatchObject({
        arm_state: 'armed',
        arm_mode: 'away',
        open_sensors: [4],
      });

      await postEvent(newEvent('disarmed', { user_id: 3 }));

      expect(await readDevice()).toMatchObject({
        arm_state: 'disarmed',
        arm_mode: null,
        open_sensors: [4],
      });
      expect(await countStoredEvents()).toBe(6);
    });

    it('updates last_seen_at', async () => {
      await postEvent(sensorOpened).expect(201);
      await setLastSeenAt(LONG_AGO);

      await postEvent(
        newEvent('heartbeat', { battery_pct: 87, rssi_dbm: -71 }),
      ).expect(201);

      expect((await readDevice()).last_seen_at).not.toEqual(LONG_AGO);
    });

    it.each([
      ['above', { battery_pct: 120, rssi_dbm: 99 }],
      ['below', { battery_pct: -1, rssi_dbm: -200 }],
    ])(
      'records a heartbeat with readings %s the usual range as sent',
      async (_case, payload) => {
        await postEvent(sensorOpened).expect(201);
        await setLastSeenAt(LONG_AGO);

        const response = await postEvent(newEvent('heartbeat', payload));

        expect(response.status).toBe(201);
        expect(response.body.payload).toEqual(payload);
        expect((await readDevice()).last_seen_at).not.toEqual(LONG_AGO);
      },
    );

    it('strips unknown payload fields before storing', async () => {
      const response = await postEvent({
        ...sensorOpened,
        type: 'heartbeat',
        payload: { battery_pct: 87, rssi_dbm: -71, firmware: '1.2.3' },
      });

      expect(response.status).toBe(201);
      expect(response.body.payload).toEqual({ battery_pct: 87, rssi_dbm: -71 });
    });
  });

  describe('a duplicate event_id', () => {
    it('returns 200 with the stored event', async () => {
      const first = await postEvent(sensorOpened).expect(201);

      const retry = await postEvent(sensorOpened);

      expect(retry.status).toBe(200);
      expect(retry.body).toEqual(first.body);
      expect(await countStoredEvents()).toBe(1);
    });

    it('returns the stored event and ignores a retry with a different body', async () => {
      await postEvent(sensorOpened).expect(201);

      const retry = await postEvent({
        ...sensorOpened,
        type: 'sensor_closed',
        occurred_at: '2026-09-29T15:00:00Z',
      });

      expect(retry.status).toBe(200);
      expect(retry.body).toMatchObject({
        type: 'sensor_opened',
        occurred_at: '2026-09-29T14:02:00Z',
      });
      expect((await readDevice()).open_sensors).toEqual([4]);
    });

    it('does not change last_seen_at', async () => {
      await postEvent(sensorOpened).expect(201);
      await setLastSeenAt(LONG_AGO);

      await postEvent(sensorOpened).expect(200);

      expect((await readDevice()).last_seen_at).toEqual(LONG_AGO);
    });

    it('is a new event when it comes from another device', async () => {
      await postEvent(sensorOpened, 'panel-0001').expect(201);

      await postEvent(sensorOpened, 'panel-0002').expect(201);

      expect(await countStoredEvents()).toBe(2);
    });
  });

  describe('requests that arrive at the same time', () => {
    // Without this setup the two requests run one after the other and the
    // tests would pass even if the race were not handled.
    beforeEach(async () => {
      // Supertest starts and stops its own listener per request unless the
      // server is already listening, which breaks requests sent in parallel.
      await app.listen(0);
      // For a new device the second request waits on the INSERT into devices
      // until the first commits, so the device must exist already.
      await postEvent(
        newEvent('heartbeat', { battery_pct: 87, rssi_dbm: -71 }),
      ).expect(201);
      // Otherwise the second request is still opening a connection while the
      // first one commits.
      await Promise.all([db.pool.query('SELECT 1'), db.pool.query('SELECT 1')]);
    });

    it('records an event and its simultaneous retry once', async () => {
      const responses = await Promise.all([
        postEvent(sensorOpened),
        postEvent(sensorOpened),
      ]);

      const statuses = responses.map((response) => response.status);
      expect(statuses).toEqual(expect.arrayContaining([200, 201]));
      // The heartbeat from beforeEach plus one sensor_opened.
      expect(await countStoredEvents()).toBe(2);
    });

    it('applies both of two different simultaneous events', async () => {
      await Promise.all([
        postEvent(newEvent('sensor_opened', { sensor_id: 4 })).expect(201),
        postEvent(newEvent('sensor_opened', { sensor_id: 7 })).expect(201),
      ]);

      expect((await readDevice()).open_sensors).toEqual([4, 7]);
    });
  });

  describe('an invalid request', () => {
    it('checks the token before validating the body', () => {
      return request(app.getHttpServer())
        .post(`/devices/${DEVICE_ID}/events`)
        .send({ type: 'exploded' })
        .expect(401);
    });

    it('rejects malformed JSON with 400', async () => {
      await request(app.getHttpServer())
        .post(`/devices/${DEVICE_ID}/events`)
        .set('X-Device-Token', DEVICE_TOKEN)
        .set('Content-Type', 'application/json')
        .send('{"event_id": ')
        .expect(400);

      expect(await countStoredEvents()).toBe(0);
    });

    it('rejects an empty body with 400', async () => {
      await postEvent({}).expect(400);

      expect(await countStoredEvents()).toBe(0);
    });

    it('does not change a known device', async () => {
      await postEvent(sensorOpened).expect(201);
      await setLastSeenAt(LONG_AGO);

      await postEvent(newEvent('sensor_closed', { sensor_id: 65 })).expect(400);

      expect(await readDevice()).toMatchObject({
        last_seen_at: LONG_AGO,
        open_sensors: [4],
      });
      expect(await countStoredEvents()).toBe(1);
    });

    it.each([
      ['missing event_id', { event_id: undefined }, 'event_id must be a UUID'],
      ['non-UUID event_id', { event_id: 'abc' }, 'event_id must be a UUID'],
      [
        'unknown type',
        { type: 'exploded' },
        'type must be one of armed, disarmed, sensor_opened, sensor_closed, heartbeat',
      ],
      [
        'missing type',
        { type: undefined },
        'type must be one of armed, disarmed, sensor_opened, sensor_closed, heartbeat',
      ],
      [
        'non-timestamp occurred_at',
        { occurred_at: 'yesterday' },
        'occurred_at must be a UTC ISO 8601 timestamp, e.g. 2026-09-29T14:02:00Z',
      ],
      [
        'occurred_at with a non-UTC offset',
        { occurred_at: '2026-09-29T14:02:00+02:00' },
        'occurred_at must be a UTC ISO 8601 timestamp, e.g. 2026-09-29T14:02:00Z',
      ],
      [
        'date-only occurred_at',
        { occurred_at: '2026-09-29' },
        'occurred_at must be a UTC ISO 8601 timestamp, e.g. 2026-09-29T14:02:00Z',
      ],
      [
        'impossible occurred_at date',
        { occurred_at: '2026-02-30T14:02:00Z' },
        'occurred_at must be a valid ISO 8601 date string',
      ],
      ['missing payload', { payload: undefined }, 'payload must be an object'],
      ['array payload', { payload: [4] }, 'payload must be an object'],
      [
        'sensor_id below 1',
        { payload: { sensor_id: 0 } },
        'payload.sensor_id must not be less than 1',
      ],
      [
        'sensor_id above 64',
        { payload: { sensor_id: 65 } },
        'payload.sensor_id must not be greater than 64',
      ],
      [
        'string sensor_id',
        { payload: { sensor_id: '4' } },
        'payload.sensor_id must be an integer number',
      ],
      [
        'unknown arm mode',
        { type: 'armed', payload: { mode: 'banana', user_id: 3 } },
        'payload.mode must be one of away, stay',
      ],
      [
        'armed without user_id',
        { type: 'armed', payload: { mode: 'away' } },
        'payload.user_id must be an integer number',
      ],
      [
        'heartbeat with a payload for another type',
        { type: 'heartbeat', payload: { sensor_id: 4 } },
        'payload.battery_pct must be an integer number',
      ],
    ])(
      'rejects %s with 400 and stores nothing',
      async (_case, override, expectedMessage) => {
        const response = await postEvent({ ...sensorOpened, ...override });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain(expectedMessage);
        expect(await countStoredEvents()).toBe(0);
      },
    );
  });
});
