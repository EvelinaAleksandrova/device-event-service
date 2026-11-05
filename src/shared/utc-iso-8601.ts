// A UTC ISO 8601 timestamp such as 2026-09-29T14:02:00Z. Rejects date-only,
// week dates and non-UTC offsets; pair it with IsISO8601 strict for Feb 30.
export const UTC_ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
