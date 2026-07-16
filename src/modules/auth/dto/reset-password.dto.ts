import { IsNotEmpty, IsString } from 'class-validator';
import { IsPassword } from 'src/common/validators';

export class ResetPasswordDto {
  @IsString({ message: 'Access Token must be a string' })
  @IsNotEmpty({ message: 'Access Token is required' })
  accessToken!: string;

  @IsPassword('New password')
  newPassword!: string;
}
