import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Database } from './../src/database/database';
import { createApp, DEVICE_TOKEN } from './create-app';

const DEVICE_ID = 'panel-0042';
const OTHER_DEVICE_ID = 'panel-0001';
const HEARTBEAT_PAYLOAD = { battery_pct: 87, rssi_dbm: -71 };

interface HistoryEventBody {
  event_id: string;
  type: string;
  occurred_at: string;
  payload: object;
}

function heartbeatAt(occurredAt: string) {
  return {
    event_id: randomUUID(),
    type: 'heartbeat',
    occurred_at: occurredAt,
    payload: HEARTBEAT_PAYLOAD,
  };
}

describe('GET /devices/:id/events (e2e)', () => {
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
      .send(body)
      .expect(201);
  }

  function get(url: string) {
    return request(app.getHttpServer())
      .get(url)
      .set('X-Device-Token', DEVICE_TOKEN);
  }

  // Follows next until null. The page cap turns a cursor that never advances
  // into a failure instead of a hanging test.
  async function walk(firstUrl: string) {
    const events: HistoryEventBody[] = [];
    let url: string | null = firstUrl;
    for (let page = 0; url !== null; page++) {
      if (page === 100) {
        throw new Error(`next still not null after 100 pages: ${url}`);
      }
      const response = await get(url).expect(200);
      events.push(...(response.body.events as HistoryEventBody[]));
      url = response.body.next as string | null;
    }
    return events;
  }

  // Through SQL rather than POST, for the tests that need hundreds of events.
  // The first one is POSTed so the device row exists.
  async function storeHeartbeats(count: number) {
    await postEvent(heartbeatAt('2026-09-29T14:00:00Z'));
    await db.pool.query(
      `INSERT INTO device_events (device_id, event_id, type, occurred_at, payload, received_at)
       SELECT $1, gen_random_uuid(), 'heartbeat',
              '2026-09-29T14:00:00Z'::timestamptz + n * interval '1 second', $2, now()
       FROM generate_series(1, $3) AS n`,
      [DEVICE_ID, HEARTBEAT_PAYLOAD, count - 1],
    );
  }

  describe('a device with events', () => {
    it('returns events oldest first by occurred_at, with only the public fields', async () => {
      const later = await postEvent({
        event_id: randomUUID(),
        type: 'armed',
        occurred_at: '2026-09-29T14:00:00Z',
        payload: { mode: 'away', user_id: 3 },
      });
      const earlier = await postEvent({
        event_id: randomUUID(),
        type: 'sensor_opened',
        occurred_at: '2026-09-29T13:59:00Z',
        payload: { sensor_id: 4 },
      });

      const response = await get(`/devices/${DEVICE_ID}/events`).expect(200);

      expect(response.body).toEqual({
        events: [
          {
            event_id: earlier.body.event_id,
            type: 'sensor_opened',
            occurred_at: '2026-09-29T13:59:00Z',
            payload: { sensor_id: 4 },
          },
          {
            event_id: later.body.event_id,
            type: 'armed',
            occurred_at: '2026-09-29T14:00:00Z',
            payload: { mode: 'away', user_id: 3 },
          },
        ],
        next: null,
      });
    });

    it('only returns the requested device', async () => {
      await postEvent(heartbeatAt('2026-09-29T14:00:00Z'));
      await postEvent(heartbeatAt('2026-09-29T14:00:00Z'), OTHER_DEVICE_ID);

      const response = await get(`/devices/${DEVICE_ID}/events`).expect(200);

      expect(response.body.events).toHaveLength(1);
    });

    it('includes events at exactly since', async () => {
      await postEvent(heartbeatAt('2026-09-29T14:00:00Z'));
      await postEvent(heartbeatAt('2026-09-29T14:01:00Z'));
      await postEvent(heartbeatAt('2026-09-29T14:02:00Z'));

      const response = await get(
        `/devices/${DEVICE_ID}/events?since=2026-09-29T14:01:00Z`,
      ).expect(200);

      expect(
        response.body.events.map(
          (event: HistoryEventBody) => event.occurred_at,
        ),
      ).toEqual(['2026-09-29T14:01:00Z', '2026-09-29T14:02:00Z']);
    });

    it('returns an empty page when nothing is at or after since', async () => {
      await postEvent(heartbeatAt('2026-09-29T14:00:00Z'));

      const response = await get(
        `/devices/${DEVICE_ID}/events?since=2026-09-29T14:00:01Z`,
      ).expect(200);

      expect(response.body).toEqual({ events: [], next: null });
    });
  });

  describe('pages', () => {
    it('defaults limit to 50', async () => {
      await storeHeartbeats(51);

      const response = await get(`/devices/${DEVICE_ID}/events`).expect(200);

      expect(response.body.events).toHaveLength(50);
      expect(response.body.next).toMatch(
        new RegExp(`^/devices/${DEVICE_ID}/events\\?limit=50&cursor=\\d+$`),
      );
    });

    it('returns up to 500 events with limit=500', async () => {
      await storeHeartbeats(501);

      const response = await get(
        `/devices/${DEVICE_ID}/events?limit=500`,
      ).expect(200);

      expect(response.body.events).toHaveLength(500);
      expect(response.body.next).not.toBeNull();
    });

    it('returns next: null when the last page is exactly full', async () => {
      await postEvent(heartbeatAt('2026-09-29T14:00:00Z'));
      await postEvent(heartbeatAt('2026-09-29T14:01:00Z'));

      const response = await get(`/devices/${DEVICE_ID}/events?limit=2`).expect(
        200,
      );

      expect(response.body.events).toHaveLength(2);
      expect(response.body.next).toBeNull();
    });

    it('walks the full history, ending with next: null', async () => {
      const posted = [];
      for (const minute of ['00', '01', '02', '03', '04']) {
        posted.push(
          await postEvent(heartbeatAt(`2026-09-29T14:${minute}:00Z`)),
        );
      }

      const events = await walk(`/devices/${DEVICE_ID}/events?limit=2`);

      expect(events.map((event) => event.event_id)).toEqual(
        posted.map((response) => response.body.event_id),
      );
    });

    it('keeps since on later pages', async () => {
      await postEvent(heartbeatAt('2026-09-29T13:00:00Z'));
      await postEvent(heartbeatAt('2026-09-29T14:00:00Z'));
      await postEvent(heartbeatAt('2026-09-29T14:01:00Z'));
      await postEvent(heartbeatAt('2026-09-29T14:02:00Z'));

      const events = await walk(
        `/devices/${DEVICE_ID}/events?since=2026-09-29T14:00:00Z&limit=1`,
      );

      expect(events.map((event) => event.occurred_at)).toEqual([
        '2026-09-29T14:00:00Z',
        '2026-09-29T14:01:00Z',
        '2026-09-29T14:02:00Z',
      ]);
    });

    it('pages through events that share one occurred_at, in arrival order', async () => {
      const posted = [];
      for (let index = 0; index < 7; index++) {
        posted.push(await postEvent(heartbeatAt('2026-09-29T14:00:00Z')));
      }

      const events = await walk(`/devices/${DEVICE_ID}/events?limit=2`);

      expect(events.map((event) => event.event_id)).toEqual(
        posted.map((response) => response.body.event_id),
      );
    });

    // A JS Date keeps only milliseconds, so a cursor holding occurred_at
    // would sort before the stored value and return the same event again.
    it('does not repeat events whose occurred_at has microseconds', async () => {
      await postEvent(heartbeatAt('2026-09-29T14:00:00.123456Z'));
      await postEvent(heartbeatAt('2026-09-29T14:00:00.123456Z'));
      await postEvent(heartbeatAt('2026-09-29T14:00:00.123789Z'));

      const events = await walk(`/devices/${DEVICE_ID}/events?limit=1`);

      expect(events).toHaveLength(3);
    });

    it('shows an event stored after the first page on a later page', async () => {
      await postEvent(heartbeatAt('2026-09-29T14:00:00Z'));
      await postEvent(heartbeatAt('2026-09-29T14:01:00Z'));
      const firstPage = await get(
        `/devices/${DEVICE_ID}/events?limit=1`,
      ).expect(200);

      const late = await postEvent(heartbeatAt('2026-09-29T14:02:00Z'));
      const rest = await walk(firstPage.body.next as string);

      expect(rest.map((event) => event.occurred_at)).toEqual([
        '2026-09-29T14:01:00Z',
        '2026-09-29T14:02:00Z',
      ]);
      expect(rest[1].event_id).toBe(late.body.event_id);
    });
  });

  describe('an invalid request', () => {
    beforeEach(async () => {
      await postEvent(heartbeatAt('2026-09-29T14:00:00Z'));
    });

    it('rejects a missing token with 401', () => {
      return request(app.getHttpServer())
        .get(`/devices/${DEVICE_ID}/events`)
        .expect(401);
    });

    it('returns 404 for a device that has never sent an event', async () => {
      const response = await get('/devices/panel-9999/events').expect(404);

      expect(response.body).toEqual({
        error: true,
        message: 'Device panel-9999 not found',
      });
    });

    it.each([
      ['0', 'limit=0'],
      ['501', 'limit=501'],
      ['-1', 'limit=-1'],
      ['empty', 'limit='],
      ['not a number', 'limit=abc'],
      ['a decimal', 'limit=2.5'],
      ['exponent notation', 'limit=1e2'],
      ['repeated', 'limit=1&limit=2'],
    ])('rejects a %s limit with 400', async (_case, queryString) => {
      const response = await get(
        `/devices/${DEVICE_ID}/events?${queryString}`,
      ).expect(400);

      expect(response.body).toEqual({
        error: true,
        message: 'limit must be an integer from 1 to 500',
      });
    });

    it.each([
      ['not a timestamp', 'yesterday'],
      ['date only', '2026-09-29'],
      ['a non-UTC offset', '2026-09-29T14:00:00%2B02:00'],
    ])('rejects since that is %s with 400', async (_case, since) => {
      const response = await get(
        `/devices/${DEVICE_ID}/events?since=${since}`,
      ).expect(400);

      expect(response.body.message).toContain(
        'since must be a UTC ISO 8601 timestamp, e.g. 2026-09-29T13:00:00Z',
      );
    });

    it('rejects an impossible since date with 400', async () => {
      const response = await get(
        `/devices/${DEVICE_ID}/events?since=2026-02-30T14:00:00Z`,
      ).expect(400);

      expect(response.body.message).toContain(
        'since must be a valid ISO 8601 date string',
      );
    });

    it.each([
      ['not a number', 'abc'],
      ['zero', '0'],
      ['beyond a safe integer', '99999999999999999999'],
      ['unknown', '999999999'],
    ])('rejects a cursor that is %s with 400', async (_case, cursor) => {
      const response = await get(
        `/devices/${DEVICE_ID}/events?cursor=${cursor}`,
      ).expect(400);

      expect(response.body).toEqual({
        error: true,
        message: 'cursor is invalid',
      });
    });

    it("rejects another device's cursor with 400", async () => {
      await postEvent(heartbeatAt('2026-09-29T14:00:00Z'), OTHER_DEVICE_ID);
      await postEvent(heartbeatAt('2026-09-29T14:01:00Z'), OTHER_DEVICE_ID);
      const otherPage = await get(
        `/devices/${OTHER_DEVICE_ID}/events?limit=1`,
      ).expect(200);
      const cursor = new URL(
        otherPage.body.next as string,
        'http://localhost',
      ).searchParams.get('cursor');

      const response = await get(
        `/devices/${DEVICE_ID}/events?cursor=${cursor}`,
      ).expect(400);

      expect(response.body.message).toBe('cursor is invalid');
    });
  });
});
