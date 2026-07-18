import { registerAs } from '@nestjs/config';
import { getEnvValue } from './env.validation';

export const jwtConfig = registerAs('jwt', () => ({
  secret: getEnvValue<string>('JWT_SECRET'),
  refreshSecret: getEnvValue<string>('JWT_REFRESH_SECRET'),
  accessTokenTtlSeconds: Number(
    getEnvValue<number>('JWT_ACCESS_TOKEN_TTL_SECONDS') ?? 900,
  ),
  refreshTokenTtlSeconds: Number(
    getEnvValue<number>('JWT_REFRESH_TOKEN_TTL_SECONDS') ?? 2592000,
  ),
}));
