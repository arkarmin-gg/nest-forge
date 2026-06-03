import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ResponseUtil } from '../utils/response.util';

interface PostgresDriverError {
  code?: string;
  detail?: string;
  constraint?: string;
}

type QueryFailedErrorWithDriver = QueryFailedError & {
  driverError?: PostgresDriverError;
};

@Catch(QueryFailedError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const response = ctx.getResponse<Response>();
    const driverError = (exception as QueryFailedErrorWithDriver).driverError;
    const code = driverError?.code;

    const requestId = request.requestId ?? 'unknown';
    const userId = (request as any).user?.id ?? 'unauthenticated';
    const clientIp = request.ip ?? 'unknown';

    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} | user:${userId} ip:${clientIp} | DB error [${code ?? 'unknown'}]: ${exception.message}`,
      exception.stack,
    );

    switch (code) {
      case '23505': {
        const detail = driverError?.detail ?? 'Duplicate key value';
        const parsed = this.parseUniqueConstraintDetail(detail);
        const message = parsed.field
          ? `${parsed.field} already exists`
          : 'Duplicate value violates unique constraint';
        return response.status(HttpStatus.CONFLICT).json(
          ResponseUtil.error(message, HttpStatus.CONFLICT, 'Conflict', {
            constraint: driverError?.constraint,
            field: parsed.field,
            value: parsed.value,
          }),
        );
      }

      case '23503':
        return response
          .status(HttpStatus.UNPROCESSABLE_ENTITY)
          .json(
            ResponseUtil.error(
              'Referenced resource does not exist',
              HttpStatus.UNPROCESSABLE_ENTITY,
              'Foreign Key Violation',
              { constraint: driverError?.constraint },
            ),
          );

      case '23502':
        return response
          .status(HttpStatus.BAD_REQUEST)
          .json(
            ResponseUtil.error(
              'A required field is missing',
              HttpStatus.BAD_REQUEST,
              'Not Null Violation',
              { constraint: driverError?.constraint },
            ),
          );

      case '22P02':
        return response
          .status(HttpStatus.BAD_REQUEST)
          .json(
            ResponseUtil.error(
              'Invalid UUID format',
              HttpStatus.BAD_REQUEST,
              'Bad Request',
            ),
          );

      default:
        return response
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .json(
            ResponseUtil.error(
              'A database error occurred',
              HttpStatus.INTERNAL_SERVER_ERROR,
              'Database Error',
            ),
          );
    }
  }

  private parseUniqueConstraintDetail(detail: string): {
    field?: string;
    value?: string;
  } {
    const match = /Key \((.+)\)=\((.+)\) already exists\./.exec(detail);
    if (match && match.length >= 3) {
      return { field: match[1], value: match[2] };
    }
    return {};
  }
}
