import { registerAs } from '@nestjs/config';
import type { ValidationResult } from 'joi';
import { databaseEnvValidationSchema, getEnvValue } from './env.validation';

interface DatabaseEnv {
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;
}

export function validateDatabaseEnv(config: NodeJS.ProcessEnv): DatabaseEnv {
  const databaseEnv = {
    DB_HOST: config.DB_HOST,
    DB_PORT: config.DB_PORT,
    DB_USERNAME: config.DB_USERNAME,
    DB_PASSWORD: config.DB_PASSWORD,
    DB_NAME: config.DB_NAME,
  };

  const validationResult = databaseEnvValidationSchema.validate(databaseEnv, {
    abortEarly: false,
    convert: true,
    allowUnknown: true,
  }) as ValidationResult<DatabaseEnv>;

  if (validationResult.error) {
    throw new Error(
      `Database config validation error: ${validationResult.error.message}`,
    );
  }

  return validationResult.value;
}

export const databaseConfig = registerAs('database', () => ({
  host: getEnvValue<string>('DB_HOST'),
  port: Number(getEnvValue<number>('DB_PORT') ?? 5432),
  username: getEnvValue<string>('DB_USERNAME'),
  password: getEnvValue<string>('DB_PASSWORD'),
  name: getEnvValue<string>('DB_NAME'),
}));
