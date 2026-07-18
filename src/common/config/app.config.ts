import { registerAs } from '@nestjs/config';
import { getEnvValue } from './env.validation';

export const appConfig = registerAs('app', () => ({
  name: getEnvValue<string>('APP_NAME') ?? 'nest-forge',
  nodeEnv: getEnvValue<string>('NODE_ENV') ?? 'development',
  port: Number(getEnvValue<number>('PORT') ?? 3000),
  timezone: 'UTC',
  isProduction: getEnvValue<string>('NODE_ENV') === 'production',
}));
