import { DeviceStatus } from './enums/device-status.enum';

// The oldest last_seen_at that still counts as online at `now`. The spec says
// offline once MORE than the threshold has passed, so exactly 5:00 is online.
export function onlineCutoff(now: Date, offlineAfterMs: number): Date {
  return new Date(now.getTime() - offlineAfterMs);
}

export function statusAt(
  lastSeenAt: Date,
  now: Date,
  offlineAfterMs: number,
): DeviceStatus {
  return lastSeenAt.getTime() < onlineCutoff(now, offlineAfterMs).getTime()
    ? DeviceStatus.OFFLINE
    : DeviceStatus.ONLINE;
}
