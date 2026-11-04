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

## Design decisions

- **Dedupe in the database.** `(device_id, event_id)` is the primary key of `device_events`, and the insert uses `ON CONFLICT DO NOTHING`, so a retry that arrives at the same time as the original is still stored once.
- Each event is saved in one transaction that locks the device row, so two events for the same device can't overwrite each other.
- The current state of each device is kept in the `devices` table and updated with every new event.

## Assumptions

- The device id can be any string, without a specific format. A device is created by its first event; there is no registration step.
- All devices share one `DEVICE_TOKEN`, and the token isn't tied to a device id, so anyone with the token can send events for any device.
- A retry with the same `event_id` but a different body returns the stored event.
- Each device's events arrive in the order they occurred, as the task allows. The service applies them in arrival order and stores `occurred_at` without using it for ordering.
- `last_seen_at` is the server time of the last new event. Duplicates and invalid events don't change it.
- Users are managed by another system (e.g. a user or employee service). The service checks only that `user_id` is a positive integer, stores it as received, and doesn't reject an event because the user is unknown.
- Heartbeat values are stored as sent, with no range check, so a heartbeat is never rejected because of an odd reading.
- Unknown payload fields are dropped.

## Where I used AI tools

I used Claude Code for these parts:

- The tests, including the `X-Device-Token` guard tests, the Postgres connection e2e test, and the shared `createApp()` helper (`test/create-app.ts`) that starts the app for the e2e tests.
- The `Database` class that connects to Postgres.
- The DTO validation and the dedupe in the ingest transaction: I wrote the first version, and Claude Code extended both.
- Reviewing and formatting this README, and writing parts of it: the API reference and the setup and test notes.
