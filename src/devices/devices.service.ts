import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Database } from '../database/database';
import { DeviceEventDto } from './dto/device-event.dto';
import { EventHistoryQuery } from './dto/event-history-query.dto';
import { Device, DeviceState, DeviceSummary } from './entities/device';
import { DeviceEvent, HistoryEvent } from './entities/device-event';
import { applyEvent } from './apply-event';
import { ConfigService } from '@nestjs/config';
import { onlineCutoff, statusAt } from './device-status';
import { DeviceStatus } from './enums/device-status.enum';
import { Clock } from '../shared/clock';

export interface EventPage {
  events: HistoryEvent[];
  // The seq of the page's last event, or null on the last page.
  nextCursor: string | null;
}

@Injectable()
export class DevicesService {
  private readonly offlineAfterMs: number;

  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    configService: ConfigService,
  ) {
    const seconds = Number(
      configService.get<string>('OFFLINE_AFTER_SECONDS', '300'),
    );
    if (!Number.isInteger(seconds) || seconds <= 0) {
      throw new Error('OFFLINE_AFTER_SECONDS must be a positive integer');
    }
    this.offlineAfterMs = seconds * 1000;
  }

  async ingestEvent(
    id: string,
    dto: DeviceEventDto,
  ): Promise<{ created: boolean; event: DeviceEvent }> {
    const client = await this.db.pool.connect();
    const now = this.clock.now();
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

  async findOne(id: string): Promise<{ device: Device; status: DeviceStatus }> {
    const result = await this.db.pool.query<Device>(
      `SELECT id, last_seen_at, arm_state, arm_mode, open_sensors
       FROM devices WHERE id = $1`,
      [id],
    );
    const device = result.rows[0];
    if (!device) {
      throw new NotFoundException(`Device ${id} not found`);
    }
    const status = statusAt(
      device.last_seen_at,
      this.clock.now(),
      this.offlineAfterMs,
    );
    return { device, status };
  }

  async findAll(
    status?: DeviceStatus,
  ): Promise<{ device: DeviceSummary; status: DeviceStatus }[]> {
    const now = this.clock.now();
    const result = await this.selectSummaries(
      status,
      onlineCutoff(now, this.offlineAfterMs),
    );
    // The same `now` as the filter, so each row's status matches the filter.
    return result.rows.map((device) => ({
      device,
      status: statusAt(device.last_seen_at, now, this.offlineAfterMs),
    }));
  }

  async findEvents(
    deviceId: string,
    query: EventHistoryQuery,
  ): Promise<EventPage> {
    await this.assertHistoryReadable(deviceId, query.cursor);
    // The cursor's occurred_at is read in SQL, not passed back from JS: a JS
    // Date drops microseconds, which would repeat the boundary event.
    // One extra row tells whether another page exists, so next never leads to an empty page.
    const result = await this.db.pool.query<HistoryEvent>(
      `SELECT event_id, type, occurred_at, payload, seq
       FROM device_events
       WHERE device_id = $1
         AND ($2::timestamptz IS NULL OR occurred_at >= $2)
         AND ($3::bigint IS NULL OR (occurred_at, seq) > (
           SELECT occurred_at, seq FROM device_events
           WHERE device_id = $1 AND seq = $3
         ))
       ORDER BY occurred_at, seq
       LIMIT $4`,
      [deviceId, query.since ?? null, query.cursor ?? null, query.limit + 1],
    );
    const events = result.rows.slice(0, query.limit);
    const hasMore = result.rows.length > query.limit;
    return {
      events,
      nextCursor: hasMore ? events[events.length - 1].seq : null,
    };
  }

  // A missing cursor event would make the main query match nothing, which
  // looks like the end of the history, so it is an error instead.
  private async assertHistoryReadable(deviceId: string, cursor?: string) {
    const result = await this.db.pool.query<{
      device_exists: boolean;
      cursor_exists: boolean;
    }>(
      `SELECT
         EXISTS (SELECT 1 FROM devices WHERE id = $1) AS device_exists,
         EXISTS (SELECT 1 FROM device_events WHERE device_id = $1 AND seq = $2) AS cursor_exists`,
      [deviceId, cursor ?? null],
    );
    const { device_exists, cursor_exists } = result.rows[0];
    if (!device_exists) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }
    if (cursor !== undefined && !cursor_exists) {
      throw new BadRequestException('cursor is invalid');
    }
  }

  private selectSummaries(status: DeviceStatus | undefined, cutoff: Date) {
    switch (status) {
      case DeviceStatus.ONLINE:
        return this.db.pool.query<DeviceSummary>(
          `SELECT id, last_seen_at FROM devices WHERE last_seen_at >= $1 ORDER BY id`,
          [cutoff],
        );
      case DeviceStatus.OFFLINE:
        return this.db.pool.query<DeviceSummary>(
          `SELECT id, last_seen_at FROM devices WHERE last_seen_at < $1 ORDER BY id`,
          [cutoff],
        );
      default:
        return this.db.pool.query<DeviceSummary>(
          `SELECT id, last_seen_at FROM devices ORDER BY id`,
        );
    }
  }
}
