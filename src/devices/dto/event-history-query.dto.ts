import {
  buildMessage,
  IsISO8601,
  IsOptional,
  Matches,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';
import { UTC_ISO_8601 } from '../../shared/utc-iso-8601';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

// Digits only, so Number() can't quietly accept forms like 1e2, 0x10 or " 5".
// For the cursor, the max keeps the range check exact and the value inside Postgres BIGINT.
function IsIntegerString(
  min: number,
  max: number,
  validationOptions?: ValidationOptions,
) {
  return ValidateBy(
    {
      name: 'isIntegerString',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          /^\d+$/.test(value) &&
          Number(value) >= min &&
          Number(value) <= max,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            `${eachPrefix}$property must be an integer from ${min} to ${max}`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

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
    limit: dto.limit === undefined ? DEFAULT_LIMIT : Number(dto.limit),
    cursor: dto.cursor,
  };
}
