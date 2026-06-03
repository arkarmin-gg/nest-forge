import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordSendOTPDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
