import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { EMAIL_NOTIFICATION_QUEUE } from 'src/infrastructure/notification/constants/notification.constants';
import { HealthController } from './health.controller';
import { BullMqHealthIndicator } from './indicators/bullmq.health';

@Module({
  imports: [
    TerminusModule,
    BullModule.registerQueue({ name: EMAIL_NOTIFICATION_QUEUE }),
  ],
  controllers: [HealthController],
  providers: [BullMqHealthIndicator],
})
export class HealthModule {}
