// Public API for ActivityLogModule
export { ActivityLogModule } from './activity-log.module';
export { ActivityLogInterceptor } from './interceptors/activity-log.interceptor';

// Events (emitted by domain services)
export {
  ACTIVITY_LOG_EVENT,
  ActivityLogEvent,
} from './events/activity-log.event';
export { AUDIT_LOG_EVENT, AuditLogEvent } from './events/audit-log.event';

// Status enum (used when emitting log events from services)
export { LogStatus } from './constants/log-status.enum';

// Interfaces (for services implementing log creation)
export { CreateActivityLogData } from './interfaces/create-activity-log.interface';
export { CreateAuditLogData } from './interfaces/create-audit-log.interface';
