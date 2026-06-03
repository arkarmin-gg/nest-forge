import { SetMetadata } from '@nestjs/common';

export const REQUEST_TIMEOUT_KEY = 'request_timeout';
export const RequestTimeout = (ms: number) =>
  SetMetadata(REQUEST_TIMEOUT_KEY, ms);
