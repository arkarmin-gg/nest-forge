import { Transform } from 'class-transformer';

export const ToJson = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  });
