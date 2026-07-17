import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  LOG_JOB_ATTEMPTS,
  LOG_JOB_BACKOFF_DELAY_MS,
  LOG_QUEUE,
} from '../constants/log-queue.constants';
import { LogJobName } from '../enums/log-job-name.enum';
import { CreateActivityLogData } from '../interfaces/create-activity-log.interface';
import { CreateAuditLogData } from '../interfaces/create-audit-log.interface';

/**
 * Single entrypoint for queuing activity-log/audit-log writes. Callers enqueue
 * directly (no EventEmitter2 hop) since logs have exactly one consumer
 * (LogProcessor) and never need the fan-out an event bus provides.
 */
@Injectable()
export class LogQueueService {
  private readonly logger = new Logger(LogQueueService.name);

  constructor(
    @InjectQueue(LOG_QUEUE)
    private readonly logQueue: Queue,
  ) {}

  async enqueueActivityLog(data: CreateActivityLogData): Promise<void> {
    await this.logQueue
      .add(LogJobName.ACTIVITY_LOG, data, this.jobOptions())
      .catch((error: unknown) =>
        this.logger.error('Failed to enqueue activity log:', error),
      );
  }

  async enqueueAuditLog(data: CreateAuditLogData): Promise<void> {
    await this.logQueue
      .add(LogJobName.AUDIT_LOG, data, this.jobOptions())
      .catch((error: unknown) =>
        this.logger.error('Failed to enqueue audit log:', error),
      );
  }

  private jobOptions() {
    return {
      attempts: LOG_JOB_ATTEMPTS,
      backoff: {
        type: 'exponential' as const,
        delay: LOG_JOB_BACKOFF_DELAY_MS,
      },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    };
  }
}
