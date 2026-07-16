import { LogAction } from '../constants/log-action.enum';
import { LogStatus } from '../constants/log-status.enum';
import { CreateActivityLogData } from '../interfaces/create-activity-log.interface';

export const ACTIVITY_LOG_EVENT = 'activity.log';

export class ActivityLogEvent implements CreateActivityLogData {
  userId!: string;
  action!: LogAction;
  description!: string;
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

  constructor(data: CreateActivityLogData) {
    Object.assign(this, data);
  }
}
