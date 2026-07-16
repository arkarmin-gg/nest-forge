import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ResponseUtil } from '../utils';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ThrottlerExceptionFilter.name);

  catch(_exception: ThrottlerException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const response = ctx.getResponse<Response>();

    const requestId = request.requestId ?? 'unknown';
    const userId = (request as any).user?.id ?? 'unauthenticated';
    const clientIp = request.ip ?? 'unknown';

    this.logger.warn(
      `[${requestId}] ${request.method} ${request.url} 429 | user:${userId} ip:${clientIp} | Rate limit exceeded`,
    );

    response
      .status(HttpStatus.TOO_MANY_REQUESTS)
      .json(
        ResponseUtil.error(
          'Too many requests. Please slow down and try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
          'Too Many Requests',
        ),
      );
  }
}
