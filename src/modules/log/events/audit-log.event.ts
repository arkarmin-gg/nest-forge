import { LogAction } from '../constants/log-action.enum';
import { LogStatus } from '../constants/log-status.enum';
import { CreateAuditLogData } from '../interfaces/create-audit-log.interface';

export const AUDIT_LOG_EVENT = 'audit.log';

export class AuditLogEvent implements CreateAuditLogData {
  adminId?: string | null;
  action!: LogAction;
  description!: string;
  entityName?: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  os?: string;
  location?: string;
  status?: LogStatus;
  metadata?: Record<string, unknown>;

  constructor(data: CreateAuditLogData) {
    Object.assign(this, data);
  }
}
