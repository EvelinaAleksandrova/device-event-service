import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';

const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;

// Digits only, so Number() can't quietly accept forms like 1e2, 0x10 or " 5".
// For the history cursor, the max keeps the range check exact and the value inside Postgres BIGINT.
export function IsIntegerString(
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

// Takes a limit already validated by IsIntegerString(1, MAX_LIMIT).
export function toPageLimit(limit?: string): number {
  return limit === undefined ? DEFAULT_LIMIT : Number(limit);
}
