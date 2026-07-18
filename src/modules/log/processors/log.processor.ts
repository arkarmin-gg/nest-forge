import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LOG_QUEUE } from '../constants/log-queue.constants';
import { LogJobName } from '../enums/log-job-name.enum';
import { CreateActivityLogData } from '../interfaces/create-activity-log.interface';
import { CreateAuditLogData } from '../interfaces/create-audit-log.interface';
import { ActivityLogService } from '../services/activity-log.service';
import { AuditLogService } from '../services/audit-log.service';

@Injectable()
@Processor(LOG_QUEUE)
export class LogProcessor extends WorkerHost {
  private readonly logger = new Logger(LogProcessor.name);

  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly auditLogService: AuditLogService,
  ) {
    super();
  }

  async process(
    job: Job<CreateActivityLogData | CreateAuditLogData, void, LogJobName>,
  ): Promise<void> {
    switch (job.name) {
      case LogJobName.ACTIVITY_LOG:
        await this.activityLogService.create(job.data as CreateActivityLogData);
        break;

      case LogJobName.AUDIT_LOG:
        await this.auditLogService.create(job.data);
        break;

      default:
        throw new Error(`Unknown log job name: ${String(job.name)}`);
    }
  }
}
