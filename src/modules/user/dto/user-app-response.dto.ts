import { Expose } from 'class-transformer';

export class UserAppResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  fullName!: string;

  @Expose()
  phone!: string;

  @Expose()
  profileImageUrl!: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
