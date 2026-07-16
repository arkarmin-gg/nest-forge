import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class UserRegisterOTPVerifyDto {
  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required' })
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Phone number must be a valid international phone number',
  })
  phone!: string;

  @IsString({ message: 'OTP must be a string' })
  @IsNotEmpty({ message: 'OTP is required' })
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp!: string;

  @IsString({ message: 'Request ID must be a string' })
  @IsNotEmpty({ message: 'Request ID is required' })
  requestId!: string;
}
