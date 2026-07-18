import * as Joi from 'joi';

const requiredWhenEnabled = (toggle: string) =>
  Joi.when(toggle, {
    is: true,
    then: Joi.string().required(),
    otherwise: Joi.string().allow('').optional(),
  });

const requiredWhenSmsProviderEnabled = () =>
  Joi.when('SMS_POH_ENABLED', {
    is: true,
    then: Joi.when('SMS_MOCK_ENABLED', {
      is: false,
      then: Joi.string().required(),
      otherwise: Joi.string().allow('').optional(),
    }),
    otherwise: Joi.string().allow('').optional(),
  });

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  APP_NAME: Joi.string().default('nest-forge'),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  // Auth
  AUTH_PASSWORD_SALT_ROUNDS: Joi.number().default(10),

  // JWT — secrets must be at least 32 characters
  JWT_SECRET: Joi.string()
    .min(32)
    .invalid('replace-with-32-plus-character-secret')
    .required(),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .invalid('replace-with-different-32-plus-character-secret')
    .required(),
  JWT_ACCESS_TOKEN_TTL_SECONDS: Joi.number().default(900), // 15 minutes
  JWT_REFRESH_TOKEN_TTL_SECONDS: Joi.number().default(2592000), // 30 days

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PREFIX_KEY: Joi.string().default('nest-forge'),

  // CORS
  CORS_ORIGINS: Joi.string().optional(),

  // AWS S3 (optional — only required when file uploads are used)
  S3_ENABLED: Joi.boolean().default(false),
  AWS_ACCESS_KEY_ID: requiredWhenEnabled('S3_ENABLED'),
  AWS_SECRET_ACCESS_KEY: requiredWhenEnabled('S3_ENABLED'),
  AWS_REGION: requiredWhenEnabled('S3_ENABLED'),
  AWS_BUCKET_NAME: requiredWhenEnabled('S3_ENABLED'),
  AWS_ENDPOINT: Joi.string().allow('').optional(),

  // Seed defaults
  SEED_SUPER_ADMIN_EMAIL: Joi.string().email().required(),
  SEED_SUPER_ADMIN_PASSWORD: Joi.string()
    .min(12)
    .invalid('passwordD123!@#', 'replace-with-strong-password')
    .required(),
  SEED_SMTP_FROM_NAME: Joi.string().required(),
  SEED_SMTP_USERNAME: Joi.string().email().required(),
  SEED_SMTP_PASSWORD: Joi.string().allow('').optional(),

  // OTP
  OTP_MOCK_ENABLED: Joi.boolean().default(true),
  OTP_MOCK_CODE: Joi.string()
    .pattern(/^\d{6}$/)
    .default('000000'),

  // SMS
  SMS_MOCK_ENABLED: Joi.boolean().default(true),
  SMS_POH_ENABLED: Joi.boolean().default(false),
  SMS_POH_API_KEY: requiredWhenSmsProviderEnabled(),
  SMS_POH_API_SECRET_KEY: requiredWhenSmsProviderEnabled(),
  SMS_POH_BASE_API_URL: requiredWhenSmsProviderEnabled(),
  SMS_POH_API_BRAND: requiredWhenSmsProviderEnabled(),
  SMS_POH_API_SENDER_ID: requiredWhenSmsProviderEnabled(),
}).options({ allowUnknown: false });

let validatedEnv: Record<string, unknown> | undefined;

export function validateEnv(config: Record<string, unknown>) {
  const validationResult = envValidationSchema.validate(config, {
    abortEarly: false,
    convert: true,
  }) as Joi.ValidationResult<Record<string, unknown>>;

  if (validationResult.error) {
    throw new Error(
      `Config validation error: ${validationResult.error.message}`,
    );
  }

  validatedEnv = validationResult.value;
  return validatedEnv;
}

export function getEnvValue<T>(key: string): T | undefined {
  return (validatedEnv?.[key] ?? process.env[key]) as T | undefined;
}

export const databaseEnvValidationSchema = envValidationSchema.fork(
  [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SEED_SUPER_ADMIN_EMAIL',
    'SEED_SUPER_ADMIN_PASSWORD',
    'SEED_SMTP_FROM_NAME',
    'SEED_SMTP_USERNAME',
  ],
  (schema) => schema.optional(),
);
