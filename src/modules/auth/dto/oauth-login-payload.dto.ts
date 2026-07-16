import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { LoginProvider } from 'src/modules/user/api';

export class OAuthLoginPayload {
  @IsString()
  @IsEnum(LoginProvider)
  provider!: LoginProvider;

  @IsString()
  providerId!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Phone number must be a valid international phone number',
  })
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  fullName?: string;
}
