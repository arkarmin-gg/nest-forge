import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { AuditLog } from './entities/audit-log.entity';
import { ActivityLogService } from './services/activity-log.service';
import { AuditLogService } from './services/audit-log.service';
import { ActivityLogController } from 'src/api/v1/admin/log/log.controller';
import { ActivityLogInterceptor } from './interceptors/activity-log.interceptor';
import { LogListener } from './listeners/log.listener';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog, AuditLog])],
  controllers: [ActivityLogController],
  providers: [
    ActivityLogService,
    AuditLogService,
    ActivityLogInterceptor,
    LogListener,
  ],
  exports: [ActivityLogService, AuditLogService, ActivityLogInterceptor],
})
export class ActivityLogModule {}
