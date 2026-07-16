import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces';
import { ResponseUtil } from '../utils';

type PaginatedPayload<T> = { items: T[]; total: number };

function isPaginatedPayload<T>(value: unknown): value is PaginatedPayload<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'items' in value &&
    'total' in value &&
    Array.isArray((value as PaginatedPayload<T>).items) &&
    typeof (value as PaginatedPayload<T>).total === 'number'
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data): ApiResponse<T> => {
        if (data && typeof data === 'object' && 'success' in data) {
          return data as ApiResponse<T>;
        }

        const statusCode = response.statusCode;

        if (isPaginatedPayload(data)) {
          const page = Number(request.query['page']) || 1;
          const limit = Number(request.query['limit']) || 10;
          return ResponseUtil.paginated(
            data.items,
            data.total,
            page,
            limit,
          ) as ApiResponse<T>;
        }

        let message = 'Operation successful';
        if (request.method === 'POST' && statusCode === 201) {
          message = 'Resource created successfully';
        } else if (request.method === 'PUT' || request.method === 'PATCH') {
          message = 'Resource updated successfully';
        } else if (request.method === 'DELETE') {
          message = 'Resource deleted successfully';
        } else if (request.method === 'GET') {
          message = 'Data retrieved successfully';
        }

        return ResponseUtil.success(
          data,
          message,
          statusCode,
        ) as ApiResponse<T>;
      }),
    );
  }
}
