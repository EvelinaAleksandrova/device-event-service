import { IsISO8601, IsOptional, Matches } from 'class-validator';
import { UTC_ISO_8601 } from '../../shared/utc-iso-8601';
import { IsIntegerString, MAX_LIMIT, toPageLimit } from './page-limit';

// Query values arrive as strings and the global ValidationPipe doesn't
// transform, so this class only validates; toEventHistoryQuery converts limit.
export class EventHistoryQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(UTC_ISO_8601, {
    message:
      'since must be a UTC ISO 8601 timestamp, e.g. 2026-09-29T13:00:00Z',
  })
  readonly since?: string;

  @IsOptional()
  @IsIntegerString(1, MAX_LIMIT)
  readonly limit?: string;

  // Opaque to clients: one message whether it is malformed or unknown.
  @IsOptional()
  @IsIntegerString(1, Number.MAX_SAFE_INTEGER, { message: 'cursor is invalid' })
  readonly cursor?: string;
}

export interface EventHistoryQuery {
  // Kept as a string so Postgres parses it, with no JS Date rounding.
  since?: string;
  limit: number;
  // The seq of the last event on the previous page. A string, like the seq
  // pg returns, since only Postgres compares it.
  cursor?: string;
}

export function toEventHistoryQuery(
  dto: EventHistoryQueryDto,
): EventHistoryQuery {
  return {
    since: dto.since,
    limit: toPageLimit(dto.limit),
    cursor: dto.cursor,
  };
}
