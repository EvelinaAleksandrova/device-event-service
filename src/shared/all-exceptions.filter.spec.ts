import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

type SentResponse = { status?: number; body?: unknown };

function catchException(exception: unknown): SentResponse {
  const sent: SentResponse = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return response;
    },
    json(body: unknown) {
      sent.body = body;
      return response;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);
  return sent;
}

describe('AllExceptionsFilter', () => {
  let logError: jest.SpyInstance;

  beforeEach(() => {
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logError.mockRestore();
  });

  it('keeps the status and message of an HTTP exception', () => {
    expect(catchException(new UnauthorizedException('Missing token'))).toEqual({
      status: 401,
      body: { error: true, message: 'Missing token' },
    });
  });

  it('uses the message of an HTTP exception created from a string', () => {
    expect(catchException(new HttpException('Teapot', 418))).toEqual({
      status: 418,
      body: { error: true, message: 'Teapot' },
    });
  });

  it('joins the messages of every failed validation rule', () => {
    const exception = new BadRequestException([
      'payload.sensor_id must not be greater than 64',
      'payload.sensor_id must be an integer number',
    ]);

    expect(catchException(exception)).toEqual({
      status: 400,
      body: {
        error: true,
        message:
          'payload.sensor_id must not be greater than 64; payload.sensor_id must be an integer number',
      },
    });
  });

  it('does not log an HTTP exception', () => {
    catchException(new NotFoundException());

    expect(logError).not.toHaveBeenCalled();
  });

  it('answers an unexpected error with 500 and logs it without leaking it', () => {
    const crash = new Error('connect ECONNREFUSED 10.0.0.5:5432');

    expect(catchException(crash)).toEqual({
      status: 500,
      body: { error: true, message: 'Internal server error' },
    });
    expect(logError).toHaveBeenCalledWith(crash);
  });

  it('answers a thrown non-Error value with 500', () => {
    expect(catchException('something broke')).toEqual({
      status: 500,
      body: { error: true, message: 'Internal server error' },
    });
    expect(logError).toHaveBeenCalledWith('something broke');
  });
});
