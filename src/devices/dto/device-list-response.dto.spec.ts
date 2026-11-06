import { DeviceStatus } from '../enums/device-status.enum';
import { nextDeviceListUrl } from './device-list-response.dto';

describe('nextDeviceListUrl', () => {
  it('is null on the last page', () => {
    expect(nextDeviceListUrl(DeviceStatus.ONLINE, 50, null)).toBeNull();
  });

  it('carries status, limit and cursor', () => {
    expect(nextDeviceListUrl(DeviceStatus.OFFLINE, 2, 'panel-0042')).toBe(
      '/devices?status=offline&limit=2&cursor=panel-0042',
    );
  });

  it('leaves status out when the request had none', () => {
    expect(nextDeviceListUrl(undefined, 2, 'panel-0042')).toBe(
      '/devices?limit=2&cursor=panel-0042',
    );
  });

  it('escapes a cursor so it parses back to the same device id', () => {
    const deviceId = 'panel a&b+c/d=e#f?g';

    const url = nextDeviceListUrl(undefined, 2, deviceId);

    expect(url).toBe('/devices?limit=2&cursor=panel+a%26b%2Bc%2Fd%3De%23f%3Fg');
    const query = new URL(url as string, 'http://localhost').searchParams;
    expect(query.getAll('cursor')).toEqual([deviceId]);
  });
});
