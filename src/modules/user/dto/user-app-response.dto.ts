import { Expose } from 'class-transformer';

/**
 * App-zone (USER subject) view of a User.
 *
 * Secure-by-default: only the fields decorated with `@Expose()` are returned.
 * Map with `plainToInstance(UserAppResponseDto, user, { excludeExtraneousValues: true })`
 * so any field added to the User entity later never leaks to the app surface
 * unless it is explicitly added here.
 *
 * Deliberately omitted (internal / admin-only): password, isBanned,
 * registrationStage, fcmToken, googleId, appleId, loginProvider,
 * lastLoginAt, lastLogoutAt, deletedAt.
 */
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
  dateOfBirth!: string;

  @Expose()
  gender?: string;

  @Expose()
  preferLanguage?: string;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}
