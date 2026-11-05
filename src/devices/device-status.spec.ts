import { onlineCutoff, statusAt } from './device-status';
import { DeviceStatus } from './enums/device-status.enum';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const NOW = new Date('2026-09-29T14:07:00Z');

describe('onlineCutoff', () => {
  it('is the threshold before now', () => {
    expect(onlineCutoff(NOW, FIVE_MINUTES_MS)).toEqual(
      new Date('2026-09-29T14:02:00Z'),
    );
  });
});

describe('statusAt', () => {
  it.each([
    ['just now', '2026-09-29T14:07:00Z', DeviceStatus.ONLINE],
    ['4 minutes 30 seconds ago', '2026-09-29T14:02:30Z', DeviceStatus.ONLINE],
    ['exactly 5 minutes ago', '2026-09-29T14:02:00Z', DeviceStatus.ONLINE],
    [
      '5 minutes and 1 ms ago',
      '2026-09-29T14:01:59.999Z',
      DeviceStatus.OFFLINE,
    ],
    ['an hour ago', '2026-09-29T13:07:00Z', DeviceStatus.OFFLINE],
  ])('last seen %s (%s) is %s', (_case, lastSeenAt, expected) => {
    expect(statusAt(new Date(lastSeenAt), NOW, FIVE_MINUTES_MS)).toBe(expected);
  });
});
