# device-event-service

Service for ingesting device events. It records events from security panels and IoT devices in the field and keeps each device's current state.

## How to run

Requirements: Node.js 26+, Docker.

```bash
npm install
docker compose up -d --wait postgres   # Postgres on localhost:5433
cp .env.example .env                   # PORT, DATABASE_URL, DEVICE_TOKEN, OFFLINE_AFTER_SECONDS
npm run start:dev                      # http://localhost:3000
```

`db/schema.sql` is loaded only when the Postgres volume is first created. If your volume is older than the current schema, recreate it with `docker compose down -v && docker compose up -d --wait postgres`. This deletes all stored data.

### Run everything in Docker

```bash
cp .env.example .env                   # DEVICE_TOKEN and OFFLINE_AFTER_SECONDS are read from here
docker compose up -d --build --wait    # service on http://localhost:3000, Postgres on localhost:5433
```

Inside Docker the service reaches Postgres at `postgres:5432`; compose sets this `DATABASE_URL` itself, overriding the one in `.env`. Stop `npm run start:dev` first, since both use port 3000.

## How to run the tests

```bash
npm test                               # unit tests
docker compose up -d --wait postgres   # e2e tests need Postgres
npm run test:e2e
```

The e2e tests empty the `devices` and `device_events` tables before each test. By default they use the same database as `npm run start:dev`, so running them deletes your local data.

## API

Every request to `/devices` needs the `X-Device-Token` header set to `DEVICE_TOKEN`; otherwise the answer is 401. The health endpoints need no token.

### GET /health and GET /health/ready

`/health` (liveness) answers as long as the process runs; it doesn't touch the database. `/health/ready` (readiness) also checks that Postgres answers `SELECT 1`.

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/health/ready
```

`/health` answers with the plain text `ok`; `/health/ready` with:

```json
{ "status": "ok" }
```

| Endpoint        | 200                | 503                                                                      |
| --------------- | ------------------ | ------------------------------------------------------------------------ |
| `/health`       | The process is up. | Never.                                                                   |
| `/health/ready` | Postgres answers.  | Postgres is down: `{ "error": true, "message": "Database unavailable" }` |

The 503 case is covered by an e2e test (`test/health-db-down.e2e-spec.ts`) that points the app at a port where nothing listens, so the connection is refused as when Postgres is stopped.

### POST /devices/{id}/events

Records one event from a device. Resending an event with the same `event_id` returns 200 and the stored event, the same body as the first response.

```bash
curl -i -X POST http://localhost:3000/devices/panel-0042/events \
  -H "X-Device-Token: dev-shared-token" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"7c1e9a52-3b0f-4d8e-9a61-2f4b8c0d1e77","type":"sensor_opened","occurred_at":"2026-09-29T14:02:00Z","payload":{"sensor_id":4}}'
```

Body fields:

| Field         | Rule                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `event_id`    | UUID, unique per device.                                                                                  |
| `type`        | One of `armed`, `disarmed`, `sensor_opened`, `sensor_closed`, `heartbeat`.                                |
| `occurred_at` | UTC ISO 8601 timestamp ending in `Z`, e.g. `2026-09-29T14:02:00Z`. Offsets such as `+02:00` are rejected. |
| `payload`     | Object whose fields depend on `type`.                                                                     |

Payload by `type`:

| `type`                           | `payload` fields                                 |
| -------------------------------- | ------------------------------------------------ |
| `armed`                          | `mode`: `away` or `stay`; `user_id`: integer ≥ 1 |
| `disarmed`                       | `user_id`: integer ≥ 1                           |
| `sensor_opened`, `sensor_closed` | `sensor_id`: integer from 1 to 64                |
| `heartbeat`                      | `battery_pct`: integer; `rssi_dbm`: integer      |

Both 201 and 200 return the stored event:

```json
{
  "device_id": "panel-0042",
  "event_id": "7c1e9a52-3b0f-4d8e-9a61-2f4b8c0d1e77",
  "type": "sensor_opened",
  "occurred_at": "2026-09-29T14:02:00Z",
  "payload": { "sensor_id": 4 }
}
```

| Status | When                                                              |
| ------ | ----------------------------------------------------------------- |
| 201    | A new event is recorded.                                          |
| 200    | The event was already recorded (same `event_id` for this device). |
| 400    | Invalid body.                                                     |
| 401    | Missing or wrong `X-Device-Token`.                                |

### GET /devices/{id}

Returns the device's current state. `status` is `offline` once more than `OFFLINE_AFTER_SECONDS` (default 300) have passed since `last_seen_at`, and `online` otherwise.

```bash
curl -i http://localhost:3000/devices/panel-0042 -H "X-Device-Token: dev-shared-token"
```

```json
{
  "device_id": "panel-0042",
  "status": "online",
  "last_seen_at": "2026-09-29T14:02:00Z",
  "arm_state": "armed",
  "arm_mode": "away",
  "open_sensors": [4, 7]
}
```

| Status | When                                     |
| ------ | ---------------------------------------- |
| 200    | The device exists.                       |
| 401    | Missing or wrong `X-Device-Token`.       |
| 404    | The device has never sent a valid event. |

### GET /devices[?status={online|offline}&limit=]

Lists the devices, sorted by `device_id`, one page at a time. The `status` query parameter is optional. A device is `offline` once more than `OFFLINE_AFTER_SECONDS` (default 300) have passed since its `last_seen_at`, and `online` otherwise, the same as in `GET /devices/{id}`. Follow `next` until it is `null` to walk the full list. No match returns `{ "devices": [], "next": null }`.

| Parameter | Rule                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------- |
| `status`  | Optional. `online` or `offline`.                                                                      |
| `limit`   | Optional. Integer from 1 to 500, default 50, the same rule as in the history API.                     |
| `cursor`  | Set by the service in `next`; clients don't build it. The id of the last device on the previous page. |

| Request                       | Result                                                                   |
| ----------------------------- | ------------------------------------------------------------------------ |
| `GET /devices`                | First page of all devices, online and offline, each with its own status. |
| `GET /devices?status=online`  | Only online devices.                                                     |
| `GET /devices?status=offline` | Only offline devices.                                                    |
| `GET /devices?status=foo`     | 400 with an error listing the allowed values.                            |

```bash
curl -i http://localhost:3000/devices -H "X-Device-Token: dev-shared-token"
curl -i "http://localhost:3000/devices?status=online" -H "X-Device-Token: dev-shared-token"
curl -i "http://localhost:3000/devices?status=offline&limit=1" -H "X-Device-Token: dev-shared-token"
curl -i "http://localhost:3000<next>" -H "X-Device-Token: dev-shared-token"
```

`GET /devices?status=offline&limit=1` returns:

```json
{
  "devices": [
    {
      "device_id": "panel-0042",
      "status": "offline",
      "last_seen_at": "2026-09-29T14:02:00Z"
    }
  ],
  "next": "/devices?status=offline&limit=1&cursor=panel-0042"
}
```

As in the history API, `next` is `null` on the last page, even when it holds exactly `limit` devices.

| Status | When                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------- |
| 200    | Valid or missing parameters, even when no device matches.                                            |
| 400    | `status` is empty, repeated, or not `online`/`offline`; invalid `limit`; empty or repeated `cursor`. |
| 401    | Missing or wrong `X-Device-Token`.                                                                   |

An unknown `status` returns:

```json
{ "error": true, "message": "status must be one of online, offline" }
```

### GET /devices/{id}/events[?since=&limit=]

Returns the device's event history, oldest first by `occurred_at`. Events with the same `occurred_at` come back in arrival order. Follow `next` until it is `null` to walk the full history.

| Parameter | Rule                                                                                       |
| --------- | ------------------------------------------------------------------------------------------ |
| `since`   | Optional. UTC ISO 8601 timestamp ending in `Z`, the same rule as `occurred_at`. Inclusive. |
| `limit`   | Optional. Integer from 1 to 500, default 50. Digits only, so `1e2` or `2.5` is a 400.      |
| `cursor`  | Set by the service in `next`; clients don't build it. Malformed or unknown returns 400.    |

```bash
curl -i "http://localhost:3000/devices/panel-0042/events?since=2026-09-29T13:00:00Z&limit=2" -H "X-Device-Token: dev-shared-token"
curl -i "http://localhost:3000<next>" -H "X-Device-Token: dev-shared-token"
```

```json
{
  "events": [
    {
      "event_id": "7c1e9a52-3b0f-4d8e-9a61-2f4b8c0d1e77",
      "type": "armed",
      "occurred_at": "2026-09-29T14:00:00Z",
      "payload": { "mode": "away", "user_id": 3 }
    },
    {
      "event_id": "0b3f6c1d-58a4-4e2b-9f07-6d2a1c8e4b90",
      "type": "heartbeat",
      "occurred_at": "2026-09-29T14:01:00Z",
      "payload": { "battery_pct": 87, "rssi_dbm": -71 }
    }
  ],
  "next": "/devices/panel-0042/events?limit=2&cursor=17"
}
```

The cursor is a database-wide sequence number assigned when an event is stored, so `17` is only an example. Take the value from `next`.

`next` has a value only when more than `limit` events are left to return. Otherwise the page is the last one and `next` is `null`, even if it holds exactly `limit` events. A device that exists but has no events at or after `since` returns `{ "events": [], "next": null }`.

| Status | When                                                            |
| ------ | --------------------------------------------------------------- |
| 200    | The device exists, even when no event matches.                  |
| 400    | Invalid `since` or `limit`, or a malformed or unknown `cursor`. |
| 401    | Missing or wrong `X-Device-Token`.                              |
| 404    | The device has never sent a valid event.                        |

### Errors

Every error, on any route, has the same body:

```json
{
  "error": true,
  "message": "event_id must be a UUID; type must be one of armed, disarmed, sensor_opened, sensor_closed, heartbeat"
}
```

| Status | When                                   | `message`                                                    |
| ------ | -------------------------------------- | ------------------------------------------------------------ |
| 400    | Invalid body, query or malformed JSON. | Every failed validation rule, separated by `; `.             |
| 401    | Missing or wrong `X-Device-Token`.     | `Missing or wrong X-Device-Token`                            |
| 404    | Unknown device.                        | e.g. `Device panel-0042 not found`                           |
| 404    | Unknown route.                         | e.g. `Cannot GET /no-such-route`                             |
| 500    | Unexpected error in the service.       | Always `Internal server error`. The details are only logged. |
| 503    | `/health/ready` can't reach Postgres.  | `Database unavailable`                                       |

## Design decisions

- **NestJS.** I use it every day. Its guards, `ValidationPipe` and dependency injection cover the token check, input validation and the injectable `Clock` without extra libraries. Its module structure makes the service easy to extend with new features. Compared with plain Node.js, where routing, body parsing and validation would be written by hand, the cost is more dependencies and boilerplate.
- **Postgres.** The ingest endpoint relies on its transactions and `SELECT ... FOR UPDATE` to apply concurrent events correctly, and it supports partitioning for the 10x case.
- **Plain `pg`, no ORM.** Every query is visible and clear SQL, including `ON CONFLICT` for the dedupe and the row comparison behind the history cursor.
- **Dedupe in the database.** `(device_id, event_id)` is the primary key and the insert uses `ON CONFLICT DO NOTHING`, so even a simultaneous retry is stored once.
- **Row lock per device.** Each event is saved in one transaction that locks the device row, so concurrent events can't overwrite each other. Events for the same device wait for each other, but different devices still run in parallel.
- **Current state in `devices`.** The `devices` table holds each device's current state, updated by every new event. Reads are fast because nothing is rebuilt from the history, but the state and the history must be updated in the same transaction.
- **One error shape.** A global exception filter returns every error as `{ error, message }`.
- **Separate liveness and readiness.** If Postgres goes down, restarting the service doesn't help. So `/health` doesn't check the database and the platform won't restart the service in a loop; `/health/ready` does, so traffic stops until the database is back.
- **Token guard per controller.** The guard is on `DevicesController` instead of global, so `/health` stay open for the platform and monitoring, which don't send a device token. A new controller is open until it adds `@UseGuards(DeviceTokenGuard)`.

### History pagination

- **Cursor, not offset.** The client only walks forward through `next`. `OFFSET` reads and discards every earlier row, so each page gets slower; the cursor starts from the previous page's last event through the `(device_id, occurred_at, seq)` index, so every page costs about the same.
- **`seq` breaks ties.** Several events can share an `occurred_at`; a cursor on the timestamp alone would skip them or repeat a page forever. `seq` is an identity column, so `(occurred_at, seq)` is unique and same-time events come back in arrival order, which the task says is the order they occurred.
- **The cursor is only a `seq`.** The query reads that event's `occurred_at` in SQL. Postgres keeps microseconds but a JS `Date` doesn't, so a timestamp in the cursor could repeat an event.
- **An unknown cursor is a 400**, not an empty page that looks like the end of the history.
- **`limit + 1` rows** are fetched, so the last page already returns `next: null`.
- **`next` is a relative URL** and doesn't repeat `since`: every event after the cursor is at or after it.

**Tradeoffs**

- No jumping to a page or total count; the task only asks to walk forward.
- A schema change: a `seq` column, a unique index on it for the cursor lookup, and the history index.
- Two queries per page: one checks the device and cursor (404/400), then the page query.
- `seq` is global, so cursors reveal roughly how many events are stored.

### Device list pagination

- **Same contract as the history API:** `limit` (default 50, max 500), `limit + 1` rows fetched, and a relative `next` URL that is `null` on the last page.
- **The cursor is the last `device_id`.** `id` is the primary key, so `WHERE id > $cursor ORDER BY id` uses its index and needs no lookup. Unlike the history API, any non-empty cursor is a valid position, so only an empty or repeated cursor is a 400.
- **`next` repeats `status`**, or the next page would stop being filtered.
- **No index on `last_seen_at`**, because every event updates it, including a heartbeat from every device every minute. An index would have to be updated on every one of these writes, which would slow down the most frequent operation.

**Tradeoffs**

- Status is computed per page, at that request's time. A device that changes status during a walk can be missing from it, but it is never listed twice, because the list is sorted by `id`, which doesn't change.
- No total count: `count(*)` over millions of devices would be expensive on every page.

## Assumptions

- The device id is any string. A device is created by its first event; there is no registration step.
- All devices share one `DEVICE_TOKEN`, so anyone with it can send events for any device.
- A retry with the same `event_id` but a different body returns the stored event.
- Events arrive in the order they occurred, as the task allows. They're applied in arrival order; `occurred_at` is used only to order the event history.
- `since` is optional; without it the history starts at the device's first event. A history request for a device that has never sent an event is a 404, as for `GET /devices/{id}`.
- `last_seen_at` is the server time of the last new event. Duplicates and invalid events don't change it.
- Users are managed by another system. `user_id` is only checked to be a positive integer; unknown users aren't rejected.
- Heartbeat values have no range check, so an odd reading never rejects a heartbeat.
- Unknown payload fields are dropped.
- Status is computed when the device is read, not stored, so it is never stale. A device turns offline only once more than `OFFLINE_AFTER_SECONDS` (default 300) have passed since `last_seen_at`; at exactly `OFFLINE_AFTER_SECONDS` it is still online.
- The spec makes only an unknown status filter a 400, so `GET /devices` without `status` lists devices of every status. An empty or repeated `status` counts as unknown.
- `GET /devices` is paginated (`limit` 50 by default, cursor in `next`), although the spec doesn't ask for it. The device list grows without bound, and at 10M devices returning everything in one response isn't an option. This changes the empty result from `{ "devices": [] }` to `{ "devices": [], "next": null }`.

## Where I used AI tools

I used Claude Code for these parts:

- The tests and the `createApp()` e2e helper (`test/create-app.ts`).
- The `Database` class that connects to Postgres.
- DTO validation and dedupe: I wrote the first version, and Claude Code extended both.
- The global exception filter: I wrote it, and Claude Code fixed how it reports validation errors and registered it.
- Reviewing this README and writing the API reference with its `curl` examples, and the setup and test notes.
- The status endpoints: I wrote the first version, and Claude Code fixed them and added the routes and DTOs.
- The injectable `Clock` and the test `FakeClock`: Claude Code suggested them, I approved, and Claude Code wrote them, so tests set the time instead of waiting.
- The GitHub Actions workflow: I wrote a draft, and Claude Code fixed it so it runs lint, the formatting check, the build, unit tests, e2e tests against the compose Postgres, and the image build.
- The Dockerfile: I wrote the first version, and Claude Code turned it into a multi-stage Alpine build that ships only production dependencies.
- `docker-compose.yml`: I wrote the Postgres service, and Claude Code added the `app` service that waits for Postgres and connects to it by service name.
- The history API: I chose cursor pagination; Claude Code proposed the `seq` cursor read in SQL and wrote the endpoint, the query DTO and the tests, and I reviewed them.
- Pagination for `GET /devices`: I decided to paginate it by default; Claude Code wrote the code and tests, and I reviewed them.
- The health endpoints: I wrote the foundation, `/health` and `/health/ready` with the 503 when Postgres is down, and I moved the token guard from global to `DevicesController`. Claude Code fixed the tests that broke, fixed a type error, suggested the `checkLiveness`/`checkReadiness` names, and wrote the e2e test for the 503 case.

## Extension: History API

I chose the History API because pagination is something I work with every day. At work we mainly use offset-style pagination (offset or page number), because our users move between numbered pages. This task is a different case: clients only walk forward through `next`, and the history grows with every heartbeat. So I chose keyset (cursor) pagination here, and the "History pagination" section explains why.

## What would change at 10x scale

- **Retention.** Heartbeats are most of the rows (one per device per minute), only matter for recent history and don't affect device state, so they can be deleted after a few days. Other events are deleted after a set period, for example 3 to 12 months. A client paging through history that has been deleted gets `cursor is invalid`.
- **Partition `device_events` by `occurred_at`.** Retention then drops whole old partitions instead of running large `DELETE`s, which are slow and leave dead rows for vacuum. Postgres requires the partition column in the primary key, so the key becomes `(device_id, event_id, occurred_at)`. The task defines a duplicate by `event_id` alone, so a retry with a different `occurred_at` would no longer be caught. To keep that rule, dedupe in a separate unpartitioned table keyed on `(device_id, event_id)`, inserted in the same transaction. `received_at` would not work as the partition key, since a retry arrives at a new server time.
