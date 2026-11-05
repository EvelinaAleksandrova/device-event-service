// 2026-09-29T14:02:00.000Z -> 2026-09-29T14:02:00Z; keeps real milliseconds.
export const toIsoUtc = (date: Date) =>
  date.toISOString().replace('.000Z', 'Z');
