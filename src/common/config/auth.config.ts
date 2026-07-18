import { registerAs } from '@nestjs/config';
import { getEnvValue } from './env.validation';

export const authConfig = registerAs('auth', () => ({
  passwordSaltRounds: Number(
    getEnvValue<number>('AUTH_PASSWORD_SALT_ROUNDS') ?? 10,
  ),
}));
