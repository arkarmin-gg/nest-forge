import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsPassword } from 'src/common/validators';
import { LoginProvider } from '../constants/login-provider.enum';
import { ToBoolean } from 'src/common/decorators';

export class CreateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsString({ message: 'Full name must be a string' })
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  fullName!: string;

  @IsPassword()
  password!: string;

  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required' })
  phone!: string;

  @IsOptional()
  @ToBoolean()
  isBanned?: boolean;

  @IsOptional()
  @IsString({ message: 'Profile image URL must be a string' })
  profileImageUrl?: string;

  @IsOptional()
  @IsString({ message: 'Login provider must be a string' })
  @IsIn(Object.values(LoginProvider))
  loginProvider?: LoginProvider;
}
