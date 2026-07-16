import { Transform } from 'class-transformer';

export const ToBoolean = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }): boolean | undefined => {
    if (value === undefined || value === null) return undefined;
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    return undefined;
  });
