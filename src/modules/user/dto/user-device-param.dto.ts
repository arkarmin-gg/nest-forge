import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class UserDeviceParamDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Device ID must be a string' })
  @IsNotEmpty({ message: 'Device ID is required' })
  @MaxLength(128, { message: 'Device ID must not exceed 128 characters' })
  @Matches(/^[A-Za-z0-9_.:-]+$/, {
    message:
      'Device ID may only contain letters, numbers, underscores, hyphens, dots, and colons',
  })
  deviceId!: string;
}
