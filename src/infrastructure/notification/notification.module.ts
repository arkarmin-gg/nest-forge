import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/modules/user';
import { EMAIL_NOTIFICATION_QUEUE } from './constants/notification.constants';
import { ForgotPasswordCodeListener } from './listeners/forgot-password-code.listener';
import { NotificationService } from './notification.service';
import { EmailProcessor } from './processors/email.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
        prefix: configService.get<string>('REDIS_PREFIX_KEY', 'nest-forge'),
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: EMAIL_NOTIFICATION_QUEUE }),
  ],
  providers: [NotificationService, EmailProcessor, ForgotPasswordCodeListener],
  exports: [NotificationService],
})
export class NotificationModule {}
