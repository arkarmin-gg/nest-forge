import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from 'src/common/services';
import {
  EMAIL_NOTIFICATION_QUEUE,
  EmailJobName,
} from '../constants/notification.constants';
import { SendForgotPasswordResetCodePayload } from '../interfaces/notification-jobs.interface';

@Injectable()
@Processor(EMAIL_NOTIFICATION_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(
    job: Job<SendForgotPasswordResetCodePayload, void, EmailJobName>,
  ): Promise<void> {
    this.logger.log(`Processing email job: ${job.name}`);

    switch (job.name) {
      case EmailJobName.SEND_FORGOT_PASSWORD_RESET_CODE:
        await this.emailService.sendForgotPasswordResetCode(job.data);
        break;

      default:
        throw new Error(`Unknown email job name: ${String(job.name)}`);
    }
  }
}
