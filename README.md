# device-event-service

Service for ingesting device events. It records events from security panels and IoT devices in the field and keeps each device's current state.

## How to run

Requirements: Node.js 22+, Docker.

```bash
npm install
docker compose up -d --wait   # Postgres on localhost:5433
cp .env.example .env          # PORT, DATABASE_URL, DEVICE_TOKEN
npm run start:dev             # http://localhost:3000
```

`db/schema.sql` is loaded only when the Postgres volume is first created. If your volume is older than the current schema, recreate it with `docker compose down -v && docker compose up -d --wait`. This deletes all stored data.

## How to run the tests

```bash
npm test                      # unit tests
docker compose up -d --wait   # e2e tests need Postgres
npm run test:e2e
```

The e2e tests empty the `devices` and `device_events` tables before each test. By default they use the same database as `npm run start:dev`, so running them deletes your local data.

## API

Every request needs the `X-Device-Token` header set to `DEVICE_TOKEN`; otherwise the answer is 401.

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

### Errors

Every error, on any route, has the same body:

```json
{
  "error": true,
  "message": "event_id must be a UUID; type must be one of armed, disarmed, sensor_opened, sensor_closed, heartbeat"
}
```

| Status | When                               | `message`                                                    |
| ------ | ---------------------------------- | ------------------------------------------------------------ |
| 400    | Invalid body or malformed JSON.    | Every failed validation rule, separated by `; `.             |
| 401    | Missing or wrong `X-Device-Token`. | `Missing or wrong X-Device-Token`                            |
| 404    | Unknown route.                     | e.g. `Cannot GET /no-such-route`                             |
| 500    | Unexpected error in the service.   | Always `Internal server error`. The details are only logged. |

## Design decisions

- **Dedupe in the database.** `(device_id, event_id)` is the primary key and the insert uses `ON CONFLICT DO NOTHING`, so even a simultaneous retry is stored once.
- Each event is saved in one transaction that locks the device row, so concurrent events can't overwrite each other.
- The `devices` table holds each device's current state, updated by every new event.
- **One error shape.** A global exception filter returns every error as `{ error, message }`.

## Assumptions

- The device id is any string. A device is created by its first event; there is no registration step.
- All devices share one `DEVICE_TOKEN`, so anyone with it can send events for any device.
- A retry with the same `event_id` but a different body returns the stored event.
- Events arrive in the order they occurred, as the task allows. They're applied in arrival order; `occurred_at` is stored but not used for ordering.
- `last_seen_at` is the server time of the last new event. Duplicates and invalid events don't change it.
- Users are managed by another system. `user_id` is only checked to be a positive integer; unknown users aren't rejected.
- Heartbeat values have no range check, so an odd reading never rejects a heartbeat.
- Unknown payload fields are dropped.

## Where I used AI tools

I used Claude Code for these parts:

- The tests and the `createApp()` e2e helper (`test/create-app.ts`).
- The `Database` class that connects to Postgres.
- DTO validation and dedupe: I wrote the first version, and Claude Code extended both.
- The global exception filter: I wrote it, and Claude Code fixed how it reports validation errors and registered it.
- Reviewing this README and writing the API reference and the setup and test notes.
