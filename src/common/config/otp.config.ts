import { registerAs } from '@nestjs/config';
import { getEnvValue } from './env.validation';

export const otpConfig = registerAs('otp', () => ({
  mockEnabled: getEnvValue<boolean>('OTP_MOCK_ENABLED') === true,
  mockCode: getEnvValue<string>('OTP_MOCK_CODE') ?? '000000',
}));
