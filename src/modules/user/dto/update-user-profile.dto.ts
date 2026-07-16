import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Self-service profile update for the app zone (a USER editing their own /me).
 *
 * Intentionally a NARROW subset of the admin UpdateUserDto — it omits
 * privileged fields (isBanned, password, phone identity, loginProvider) so a
 * user can never escalate or mutate account-control state through /api/v1/app/me.
 */
export class UpdateUserProfileDto {
  @IsOptional()
  @IsString({ message: 'Full name must be a string' })
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  fullName?: string;

  @IsOptional()
  @IsString({ message: 'Profile image URL must be a string' })
  profileImageUrl?: string;
}
