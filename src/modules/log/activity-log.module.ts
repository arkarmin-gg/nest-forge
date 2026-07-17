import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { AuditLog } from './entities/audit-log.entity';
import { LOG_QUEUE } from './constants/log-queue.constants';
import { LogProcessor } from './processors/log.processor';
import { ActivityLogService } from './services/activity-log.service';
import { AuditLogService } from './services/audit-log.service';
import { LogQueueService } from './services/log-queue.service';
import { ActivityLogController } from 'src/api/v1/admin/log/log.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityLog, AuditLog]),
    BullModule.registerQueue({ name: LOG_QUEUE }),
  ],
  controllers: [ActivityLogController],
  providers: [
    ActivityLogService,
    AuditLogService,
    LogQueueService,
    LogProcessor,
  ],
  exports: [ActivityLogService, AuditLogService, LogQueueService],
})
export class ActivityLogModule {}
