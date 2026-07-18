import { Request } from 'express';
import type { CreateActivityLogData } from 'src/modules/log/public-api';
import { parseUserAgent } from './user-agent.util';

function getClientIp(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'] as string;
  return (
    forwarded?.split(',')[0]?.trim() ||
    (request.headers['x-real-ip'] as string) ||
    request.socket?.remoteAddress ||
    request.ip ||
    'unknown'
  );
}

export function buildRequestContext(
  request: Request,
): Pick<
  CreateActivityLogData,
  'ipAddress' | 'userAgent' | 'device' | 'browser' | 'os' | 'location'
> {
  const { device, browser, os } = parseUserAgent(request);
  return {
    ipAddress: getClientIp(request),
    userAgent: request.headers['user-agent'] || '',
    device,
    browser,
    os,
    location: (request.headers['cf-ipcountry'] as string) || undefined,
  };
}
