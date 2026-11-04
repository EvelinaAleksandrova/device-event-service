import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DeviceTokenGuard } from './device-token.guard';

const DEVICE_TOKEN = 'configured-token';

async function createGuard(
  deviceToken: string | undefined,
): Promise<DeviceTokenGuard> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      DeviceTokenGuard,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) =>
            key === 'DEVICE_TOKEN' ? deviceToken : undefined,
        },
      },
    ],
  }).compile();

  return moduleRef.get(DeviceTokenGuard);
}

function contextWithHeader(headerValue?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'x-device-token': headerValue } }),
    }),
  } as unknown as ExecutionContext;
}

describe('DeviceTokenGuard', () => {
  it('fails to start when DEVICE_TOKEN is not configured', async () => {
    await expect(createGuard(undefined)).rejects.toThrow(
      'DEVICE_TOKEN environment variable is not set',
    );
  });

  it('fails to start when DEVICE_TOKEN is empty', async () => {
    await expect(createGuard('')).rejects.toThrow(
      'DEVICE_TOKEN environment variable is not set',
    );
  });

  it('allows a request carrying the configured token', async () => {
    const guard = await createGuard(DEVICE_TOKEN);

    expect(guard.canActivate(contextWithHeader(DEVICE_TOKEN))).toBe(true);
  });

  it('rejects a request carrying a different token', async () => {
    const guard = await createGuard(DEVICE_TOKEN);

    expect(() => guard.canActivate(contextWithHeader('other-token'))).toThrow(
      UnauthorizedException,
    );
  });
});
