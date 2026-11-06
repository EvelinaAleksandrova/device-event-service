import { DeviceStatus } from '../enums/device-status.enum';
import { toListDevicesQuery } from './list-devices-query.dto';

describe('toListDevicesQuery', () => {
  it('defaults limit to 50 and leaves status and cursor unset', () => {
    expect(toListDevicesQuery({})).toEqual({
      status: undefined,
      limit: 50,
      cursor: undefined,
    });
  });

  it('converts limit to a number and keeps status and cursor as sent', () => {
    expect(
      toListDevicesQuery({
        status: DeviceStatus.OFFLINE,
        limit: '2',
        cursor: 'panel-0042',
      }),
    ).toEqual({
      status: DeviceStatus.OFFLINE,
      limit: 2,
      cursor: 'panel-0042',
    });
  });
});
