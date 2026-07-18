import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  EMAIL_NOTIFICATION_BACKOFF_DELAY_MS,
  EMAIL_NOTIFICATION_JOB_ATTEMPTS,
  EMAIL_NOTIFICATION_QUEUE,
} from './constants/notification.constants';
import { EmailJobName } from './enums/email-job-name.enum';
import { SendForgotPasswordResetCodePayload } from './interfaces/notification-jobs.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectQueue(EMAIL_NOTIFICATION_QUEUE)
    private readonly emailQueue: Queue,
  ) {}

  // ─── Email (fire-and-forget) ───────────────────────────────────────────────

  async sendForgotPasswordResetCode(
    payload: SendForgotPasswordResetCodePayload,
  ): Promise<void> {
    await this.emailQueue.add(
      EmailJobName.SEND_FORGOT_PASSWORD_RESET_CODE,
      payload,
      this.jobOptions(),
    );
    this.logger.log(`Queued password reset email for ${payload.email}`);
  }

  private jobOptions() {
    return {
      attempts: EMAIL_NOTIFICATION_JOB_ATTEMPTS,
      backoff: {
        type: 'exponential' as const,
        delay: EMAIL_NOTIFICATION_BACKOFF_DELAY_MS,
      },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    };
  }
}
