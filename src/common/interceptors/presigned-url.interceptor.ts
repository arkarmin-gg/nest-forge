import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PRESIGNED_URLS_KEY, PresignedUrlField } from '../decorators';
import { S3ClientService } from '../services';

type NormalizedPresignedUrlField = {
  path: string;
  as?: string;
};

@Injectable()
export class PresignedUrlInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly s3ClientService: S3ClientService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const fields = this.reflector.getAllAndOverride<PresignedUrlField[]>(
      PRESIGNED_URLS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!fields?.length) return next.handle();

    return next.handle().pipe(
      switchMap(async (response) => {
        if (!response?.success) return response;

        const { data } = response;
        if (!data) return response;

        await this.transformFields(data, fields);

        return response;
      }),
    );
  }

  private async transformFields(
    value: unknown,
    fields: PresignedUrlField[],
  ): Promise<void> {
    await Promise.all(
      fields.map((field) =>
        this.transformField(value, this.normalizeField(field)),
      ),
    );
  }

  private normalizeField(
    field: PresignedUrlField,
  ): NormalizedPresignedUrlField {
    if (typeof field === 'string') {
      return { path: field };
    }

    return field;
  }

  private async transformField(
    value: unknown,
    field: NormalizedPresignedUrlField,
  ): Promise<void> {
    const parts = field.path.split('.').filter(Boolean);
    if (parts.length === 0) return;

    await this.transformAtPath(value, parts, field.as);
  }

  private async transformAtPath(
    value: unknown,
    parts: string[],
    outputKey?: string,
  ): Promise<void> {
    if (Array.isArray(value)) {
      await Promise.all(
        value.map((item) => this.transformAtPath(item, parts, outputKey)),
      );
      return;
    }

    if (!this.isRecord(value)) return;

    const [currentKey, ...remainingParts] = parts;

    if (remainingParts.length > 0) {
      if (!Object.prototype.hasOwnProperty.call(value, currentKey)) return;

      await this.transformAtPath(value[currentKey], remainingParts, outputKey);
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(value, currentKey)) return;

    const resolvedUrl = await this.resolveUrl(value[currentKey]);
    const targetKey = outputKey ?? currentKey;
    value[targetKey] = resolvedUrl;

    if (outputKey && outputKey !== currentKey) {
      delete value[currentKey];
    }
  }

  private async resolveUrl(value: unknown): Promise<string | null> {
    if (typeof value !== 'string') return null;

    return this.s3ClientService.generatePresignedUrl(value);
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
