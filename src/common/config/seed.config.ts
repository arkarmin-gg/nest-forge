import { registerAs } from '@nestjs/config';
import { getEnvValue } from './env.validation';

export const seedConfig = registerAs('seed', () => ({
  superAdmin: {
    email: getEnvValue<string>('SEED_SUPER_ADMIN_EMAIL'),
    password: getEnvValue<string>('SEED_SUPER_ADMIN_PASSWORD'),
  },
  smtp: {
    fromName: getEnvValue<string>('SEED_SMTP_FROM_NAME'),
    username: getEnvValue<string>('SEED_SMTP_USERNAME'),
    password: getEnvValue<string>('SEED_SMTP_PASSWORD') ?? '',
  },
}));
