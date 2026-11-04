import { Injectable } from '@nestjs/common';
import { Database } from '../database/database';
import { DeviceEventDto } from './dto/device-event.dto';
import { DeviceState } from './entities/device';
import { DeviceEvent } from './entities/device-event';
import { applyEvent } from './apply-event';

@Injectable()
export class DevicesService {
  constructor(private readonly db: Database) {}

  async ingestEvent(
    id: string,
    dto: DeviceEventDto,
  ): Promise<{ created: boolean; event: DeviceEvent }> {
    const client = await this.db.pool.connect();
    const now = new Date();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO devices (id, last_seen_at) VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING;`,
        [id, now],
      );

      const device = await client.query<DeviceState>(
        `SELECT arm_state, arm_mode, open_sensors FROM devices
         WHERE id = $1 FOR UPDATE`,
        [id],
      );

      // A retry with an event_id the device already sent returns 200 OK with the stored event, and changes nothing.
      const event = await client.query<DeviceEvent>(
        `INSERT INTO device_events (device_id, event_id, type, occurred_at, payload, received_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (device_id, event_id) DO NOTHING
         RETURNING device_id, event_id, type, occurred_at, payload`,
        [id, dto.event_id, dto.type, dto.occurred_at, dto.payload, now],
      );
      if (event.rows.length === 0) {
        const existing = await client.query<DeviceEvent>(
          `SELECT device_id, event_id, type, occurred_at, payload 
           FROM device_events
           WHERE device_id = $1 AND event_id = $2`,
          [id, dto.event_id],
        );
        await client.query('COMMIT');
        return { created: false, event: existing.rows[0] };
      }

      const next = applyEvent(device.rows[0], dto);

      await client.query(
        `UPDATE devices
         SET last_seen_at = $2, arm_state = $3, arm_mode = $4, open_sensors = $5
         WHERE id = $1`,
        [id, now, next.arm_state, next.arm_mode, next.open_sensors],
      );
      await client.query('COMMIT');
      return { created: true, event: event.rows[0] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
