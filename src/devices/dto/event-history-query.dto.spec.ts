import { toEventHistoryQuery } from './event-history-query.dto';

describe('toEventHistoryQuery', () => {
  it('defaults limit to 50 and leaves since and cursor unset', () => {
    expect(toEventHistoryQuery({})).toEqual({
      since: undefined,
      limit: 50,
      cursor: undefined,
    });
  });

  it('converts limit to a number and keeps since and cursor as sent', () => {
    expect(
      toEventHistoryQuery({
        since: '2026-09-29T13:00:00.123456Z',
        limit: '2',
        cursor: '9007199254740991',
      }),
    ).toEqual({
      since: '2026-09-29T13:00:00.123456Z',
      limit: 2,
      cursor: '9007199254740991',
    });
  });
});
