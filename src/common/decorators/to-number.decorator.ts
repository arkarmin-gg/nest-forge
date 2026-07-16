import { Transform } from 'class-transformer';

export const ToNumber = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }): number | undefined => {
    if (value === undefined || value === null) return undefined;
    return Number(value);
  });
