import { SetMetadata } from '@nestjs/common';
import {
  LOG_ACTIVITY_KEY,
  ActivityLogOptions,
} from '../interceptors/activity-log.interceptor';

export const LogActivity = (options: ActivityLogOptions) =>
  SetMetadata(LOG_ACTIVITY_KEY, options);
