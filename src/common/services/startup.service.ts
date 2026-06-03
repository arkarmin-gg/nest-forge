import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';

@Injectable()
export class StartupService implements OnModuleInit {
  private readonly logger = new Logger(StartupService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.validatePostgres();
    await this.validateRedis();
    this.logger.log('All external connections validated successfully');
  }

  private async validatePostgres(): Promise<void> {
    try {
      await this.dataSource.query('SELECT 1');
      this.logger.log('Postgres connection: OK');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Postgres connection failed: ${message}`);
      throw new Error(`Startup failed — Postgres unreachable: ${message}`);
    }
  }

  private async validateRedis(): Promise<void> {
    try {
      await this.cacheManager.get('__startup_ping__');
      this.logger.log('Redis connection: OK');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Redis connection failed: ${message}`);
      throw new Error(`Startup failed — Redis unreachable: ${message}`);
    }
  }
}
