import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { Observable } from 'rxjs';

export function ParseJsonFields(...fields: string[]): Type<NestInterceptor> {
  @Injectable()
  class ParseJsonFieldsInterceptor implements NestInterceptor {
    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<unknown> {
      const request = context
        .switchToHttp()
        .getRequest<{ body?: Record<string, unknown> }>();
      const body = request.body;

      if (body && typeof body === 'object') {
        for (const field of fields) {
          const value = body[field];
          if (typeof value === 'string' && value.length > 0) {
            try {
              body[field] = JSON.parse(value);
            } catch {
              throw new BadRequestException(`${field} must be valid JSON`);
            }
          }
        }
      }

      return next.handle();
    }
  }

  return mixin(ParseJsonFieldsInterceptor);
}
