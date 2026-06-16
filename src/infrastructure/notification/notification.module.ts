import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import {
  EMAIL_NOTIFICATION_QUEUE,
  SMS_NOTIFICATION_QUEUE,
} from './constants/notification.constants';
import { ForgotPasswordCodeListener } from './listeners/forgot-password-code.listener';
import { TwoFactorCodeListener } from './listeners/two-factor-code.listener';
import { NotificationService } from './notification.service';
import { EmailProcessor } from './processors/email.processor';
import { SmsProcessor } from './processors/sms.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: EMAIL_NOTIFICATION_QUEUE },
      { name: SMS_NOTIFICATION_QUEUE },
    ),
  ],
  providers: [
    NotificationService,
    EmailProcessor,
    SmsProcessor,
    TwoFactorCodeListener,
    ForgotPasswordCodeListener,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
