import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ResponseUtil } from '../utils/response.util';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const response = ctx.getResponse<Response>();

    const requestId = request.requestId ?? 'unknown';
    const userId = (request as any).user?.id ?? 'unauthenticated';
    const clientIp = request.ip ?? 'unknown';

    const message =
      exception instanceof Error ? exception.message : 'Unexpected error';
    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} 500 | user:${userId} ip:${clientIp} | ${message}`,
      stack,
    );

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(
        ResponseUtil.error(
          'An unexpected error occurred',
          HttpStatus.INTERNAL_SERVER_ERROR,
          'Internal Server Error',
        ),
      );
  }
}
