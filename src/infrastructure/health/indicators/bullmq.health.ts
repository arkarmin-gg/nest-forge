import { getQueueToken } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Queue } from 'bullmq';
import { EMAIL_NOTIFICATION_QUEUE } from 'src/infrastructure/notification/constants/notification.constants';

@Injectable()
export class BullMqHealthIndicator {
  constructor(
    @Inject(getQueueToken(EMAIL_NOTIFICATION_QUEUE))
    private readonly emailQueue: Queue,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const client = await this.emailQueue.client;
      if (client.status !== 'ready') {
        return indicator.down({ message: `Redis status: ${client.status}` });
      }
      return indicator.up();
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'Redis unreachable',
      });
    }
  }
}
