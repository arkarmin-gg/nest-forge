import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { UserDevicePlatform } from '../enums/user-device-platform.enum';

const FCM_TOKEN_MAX_LENGTH = 4096;

function IsNullableFcmToken(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isNullableFcmToken',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === null) return true;

          return (
            typeof value === 'string' &&
            value.length > 0 &&
            value.length <= FCM_TOKEN_MAX_LENGTH
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be null or a non-empty string not exceeding ${FCM_TOKEN_MAX_LENGTH} characters`;
        },
      },
    });
  };
}

function trimNullableString(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class UpsertUserDeviceDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNullableFcmToken()
  fcmToken!: string | null;

  @IsEnum(UserDevicePlatform, {
    message: 'Platform must be one of IOS, ANDROID, or WEB',
  })
  platform!: UserDevicePlatform;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsString({ message: 'App version must be a string' })
  @MaxLength(100, { message: 'App version must not exceed 100 characters' })
  appVersion?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsString({ message: 'Device model must be a string' })
  @MaxLength(255, { message: 'Device model must not exceed 255 characters' })
  deviceModel?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimNullableString(value))
  @IsString({ message: 'OS version must be a string' })
  @MaxLength(100, { message: 'OS version must not exceed 100 characters' })
  osVersion?: string | null;
}
