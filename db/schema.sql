-- Loaded only when the Postgres volume is first created (docker-entrypoint-initdb.d).
-- To apply changes, recreate the volume: docker compose down -v && docker compose up -d
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    last_seen_at TIMESTAMPTZ NOT NULL,
    arm_state TEXT NOT NULL DEFAULT 'disarmed',
    arm_mode TEXT,
    -- sensor_id of each open sensor, kept sorted ascending.
    open_sensors SMALLINT [] NOT NULL DEFAULT '{}',
    CONSTRAINT devices_arm_state_check CHECK (arm_state IN ('armed', 'disarmed')),
    CONSTRAINT devices_arm_mode_check CHECK (arm_mode IN ('away', 'stay')),
    -- arm_mode is set exactly when armed, and null when disarmed.
    CONSTRAINT devices_arm_mode_matches_state CHECK ((arm_state = 'armed') = (arm_mode IS NOT NULL)),
    CONSTRAINT devices_open_sensors_range_check CHECK (
        1 <= ALL (open_sensors)
        AND 64 >= ALL (open_sensors)
    )
);

CREATE TABLE IF NOT EXISTS device_events (
    device_id TEXT NOT NULL REFERENCES devices (id),
    event_id UUID NOT NULL,
    type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    -- Server time the event was first received.
    received_at TIMESTAMPTZ NOT NULL,
    -- The dedupe: a resent event_id for the same device is ignored.
    CONSTRAINT device_events_pkey PRIMARY KEY (device_id, event_id),
    CONSTRAINT device_events_type_check CHECK (
        type IN (
            'armed',
            'disarmed',
            'sensor_opened',
            'sensor_closed',
            'heartbeat'
        )
    )
);