import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { IsPassword } from 'src/common/validators';

export class UserRegisterPasswordSetupDto {
  @IsPassword()
  password!: string;

  @IsPassword('Confirm password')
  confirmPassword!: string;

  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required' })
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Phone number must be a valid international phone number',
  })
  phone!: string;
}
