import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { Public } from 'src/modules/auth/public-api';
import { DataSource } from 'typeorm';
import { BullMqHealthIndicator } from './indicators/bullmq.health';

const { version } = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
) as { version: string };

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly bullMq: BullMqHealthIndicator,
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  async check() {
    const result = await this.health.check([
      () => this.db.pingCheck('database', { connection: this.dataSource }),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.bullMq.pingCheck('redis'),
    ]);
    return {
      ...result,
      version,
      appName: this.configService.get<string>('APP_NAME'),
    };
  }
}
