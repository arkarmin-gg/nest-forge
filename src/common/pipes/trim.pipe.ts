import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'param' || metadata.type === 'custom') return value;
    return this.trimDeep(value);
  }

  private trimDeep(value: unknown): unknown {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) return value.map((item) => this.trimDeep(item));
    if (value !== null && typeof value === 'object') {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        return value;
      }

      const result: Record<string, unknown> = {};
      for (const key of Object.keys(value)) {
        result[key] = this.trimDeep((value as Record<string, unknown>)[key]);
      }
      return result;
    }
    return value;
  }
}
