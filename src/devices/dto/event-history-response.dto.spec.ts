import { nextPageUrl } from './event-history-response.dto';

describe('nextPageUrl', () => {
  it('is null on the last page', () => {
    expect(nextPageUrl('panel-0042', 50, null)).toBeNull();
  });

  it('carries limit and cursor', () => {
    expect(nextPageUrl('panel-0042', 2, '17')).toBe(
      '/devices/panel-0042/events?limit=2&cursor=17',
    );
  });

  it('encodes the device id', () => {
    expect(nextPageUrl('panel/0042 a', 2, '17')).toBe(
      '/devices/panel%2F0042%20a/events?limit=2&cursor=17',
    );
  });
});
