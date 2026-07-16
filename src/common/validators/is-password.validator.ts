import { applyDecorators } from '@nestjs/common';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export function IsPassword(label = 'Password') {
  return applyDecorators(
    IsString({ message: `${label} must be a string` }),
    IsNotEmpty({ message: `${label} is required` }),
    MinLength(8, { message: `${label} must be at least 8 characters long` }),
    MaxLength(128, { message: `${label} must not exceed 128 characters` }),
    Matches(/(?=.*[A-Z])(?=.*\d)/, {
      message: `${label} must contain at least one uppercase letter and one number`,
    }),
  );
}
