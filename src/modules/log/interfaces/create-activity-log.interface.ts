import { LogAction } from '../constants/log-action.enum';
import { LogStatus } from '../constants/log-status.enum';

export interface CreateActivityLogData {
  userId: string;
  action: LogAction;
  description: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  os?: string;
  location?: string;
  status?: LogStatus;
  metadata?: Record<string, unknown>;
}
