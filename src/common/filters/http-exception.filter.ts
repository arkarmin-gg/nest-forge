import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ResponseUtil } from '../utils/response.util';

interface HttpExceptionResponseObject {
  message?: string | string[];
  details?: unknown;
  statusCode?: number;
  error?: string;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<
      Request & { requestId?: string; user?: { id?: string } }
    >();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const requestId = request.requestId ?? 'unknown';
    const userId = request.user?.id ?? 'unauthenticated';
    const clientIp = request.ip ?? 'unknown';

    let message = exception.message;
    let details: unknown = null;

    if (typeof exceptionResponse === 'object') {
      const responseObj = exceptionResponse as HttpExceptionResponseObject;
      message = Array.isArray(responseObj.message)
        ? 'Validation failed'
        : (responseObj.message ?? exception.message);
      details = Array.isArray(responseObj.message)
        ? responseObj.message
        : (responseObj.details ?? null);
    } else if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    }

    const logMethod = status >= 500 ? 'error' : 'warn';
    this.logger[logMethod](
      `[${requestId}] ${request.method} ${request.url} ${status} | user:${userId} ip:${clientIp} | ${message}`,
      status >= 500 ? exception.stack : undefined,
    );

    response
      .status(status)
      .json(
        ResponseUtil.error(message, status, this.getErrorName(status), details),
      );
  }

  private getErrorName(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'Validation Error';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';
      case HttpStatus.REQUEST_TIMEOUT:
        return 'Request Timeout';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Internal Server Error';
      default:
        return 'Error';
    }
  }
}
