import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class DeviceTokenGuard implements CanActivate {
  private readonly token: string;

  constructor() {
    const token = process.env.DEVICE_TOKEN;
    if (!token) {
      throw new Error('DEVICE_TOKEN environment variable is not set');
    }
    this.token = token;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers['x-device-token'] !== this.token) {
      throw new UnauthorizedException('Missing or wrong X-Device-Token');
    }
    return true;
  }
}
