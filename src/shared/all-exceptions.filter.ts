import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

// Every error leaves the API as { error: true, message }, whatever threw it:
// the token guard (401), ValidationPipe (400), an unknown route (404) or a crash (500).
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response
        .status(exception.getStatus())
        .json({ error: true, message: getMessage(exception) });
      return;
    }

    // Log the details for us, but don't leak them to the client.
    this.logger.error(exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: true, message: 'Internal server error' });
  }
}

// ValidationPipe sends one message per failed rule. Picking one would be
// arbitrary (class-validator runs a field's rules bottom-up, so the first is
// often a range check on a missing value), so the client gets them all.
function getMessage(exception: HttpException): string {
  const { message } = exception.getResponse() as { message?: unknown };
  return Array.isArray(message) ? message.join('; ') : exception.message;
}
