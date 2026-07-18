import { registerAs } from '@nestjs/config';
import { getEnvValue } from './env.validation';

export const corsConfig = registerAs('cors', () => ({
  origins: getEnvValue<string>('CORS_ORIGINS'),
}));
