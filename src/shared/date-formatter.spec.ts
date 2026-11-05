import { toIsoUtc } from './date-formatter';

describe('toIsoUtc', () => {
  it('drops zero milliseconds', () => {
    expect(toIsoUtc(new Date('2026-09-29T14:02:00.000Z'))).toBe(
      '2026-09-29T14:02:00Z',
    );
  });

  it('keeps non-zero milliseconds', () => {
    expect(toIsoUtc(new Date('2026-09-29T14:02:00.120Z'))).toBe(
      '2026-09-29T14:02:00.120Z',
    );
  });

  it('converts a date created with an offset to UTC', () => {
    expect(toIsoUtc(new Date('2026-09-29T16:02:00+02:00'))).toBe(
      '2026-09-29T14:02:00Z',
    );
  });
});
