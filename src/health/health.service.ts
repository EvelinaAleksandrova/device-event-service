import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Database } from '../database/database';

@Injectable()
export class HealthService {
  constructor(private readonly db: Database) {}

  checkLiveness(): string {
    return 'ok';
  }

  async checkReadiness(): Promise<{ status: string }> {
    try {
      await this.db.pool.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return { status: 'ok' };
  }
}
