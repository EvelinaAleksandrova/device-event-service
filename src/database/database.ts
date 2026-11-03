import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class Database implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(Database.name);
  readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    this.pool = new Pool({ connectionString });
    this.pool.on('error', (err) => {
      this.logger.error(`Idle PostgreSQL client error: ${err.message}`);
    });
  }

  async onModuleInit() {
    await this.pool.query('SELECT 1');
    this.logger.log('Connected to PostgreSQL');
  }

  onApplicationShutdown() {
    return this.pool.end();
  }
}
