import { registerAs } from '@nestjs/config';
import { getEnvValue } from './env.validation';

export const smsConfig = registerAs('sms', () => ({
  mockEnabled: getEnvValue<boolean>('SMS_MOCK_ENABLED') === true,
  poh: {
    enabled: getEnvValue<boolean>('SMS_POH_ENABLED') === true,
    apiKey: getEnvValue<string>('SMS_POH_API_KEY'),
    apiSecretKey: getEnvValue<string>('SMS_POH_API_SECRET_KEY'),
    baseApiUrl: getEnvValue<string>('SMS_POH_BASE_API_URL'),
    brand: getEnvValue<string>('SMS_POH_API_BRAND') || 'SMSPoh',
    senderId: getEnvValue<string>('SMS_POH_API_SENDER_ID'),
  },
}));
