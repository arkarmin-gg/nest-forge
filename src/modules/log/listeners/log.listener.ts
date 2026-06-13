import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ActivityLogService } from '../services/activity-log.service';
import { AuditLogService } from '../services/audit-log.service';
import {
  ACTIVITY_LOG_EVENT,
  ActivityLogEvent,
} from '../events/activity-log.event';
import { AUDIT_LOG_EVENT, AuditLogEvent } from '../events/audit-log.event';

@Injectable()
export class LogListener {
  private readonly logger = new Logger(LogListener.name);

  constructor(
    private readonly activityLogService: ActivityLogService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @OnEvent(ACTIVITY_LOG_EVENT)
  async handleActivityLog(event: ActivityLogEvent): Promise<void> {
    await this.activityLogService
      .create(event)
      .catch((err: unknown) =>
        this.logger.error('Failed to write activity log:', err),
      );
  }

  @OnEvent(AUDIT_LOG_EVENT)
  async handleAuditLog(event: AuditLogEvent): Promise<void> {
    await this.auditLogService
      .create(event)
      .catch((err: unknown) =>
        this.logger.error('Failed to write audit log:', err),
      );
  }
}
