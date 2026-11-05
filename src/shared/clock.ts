import { Injectable } from '@nestjs/common';

// Server time, behind a provider so tests can set it instead of waiting.
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
