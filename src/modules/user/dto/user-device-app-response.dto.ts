import { Expose } from 'class-transformer';
import { UserDevicePlatform } from '../enums/user-device-platform.enum';

export class UserDeviceAppResponseDto {
  @Expose()
  id!: string;

  @Expose()
  deviceId!: string;

  @Expose()
  platform!: UserDevicePlatform;

  @Expose()
  appVersion!: string | null;

  @Expose()
  deviceModel!: string | null;

  @Expose()
  osVersion!: string | null;

  @Expose()
  lastSeenAt!: Date;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
