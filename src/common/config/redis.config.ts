import { registerAs } from '@nestjs/config';
import { getEnvValue } from './env.validation';

export const redisConfig = registerAs('redis', () => ({
  host: getEnvValue<string>('REDIS_HOST') ?? 'localhost',
  port: Number(getEnvValue<number>('REDIS_PORT') ?? 6379),
  prefixKey: getEnvValue<string>('REDIS_PREFIX_KEY') ?? 'nest-forge',
}));
