import { registerAs } from '@nestjs/config';
import { getEnvValue } from './env.validation';

export const s3Config = registerAs('s3', () => ({
  enabled: getEnvValue<boolean>('S3_ENABLED') === true,
  accessKeyId: getEnvValue<string>('AWS_ACCESS_KEY_ID'),
  secretAccessKey: getEnvValue<string>('AWS_SECRET_ACCESS_KEY'),
  region: getEnvValue<string>('AWS_REGION'),
  bucketName: getEnvValue<string>('AWS_BUCKET_NAME'),
  endpoint: getEnvValue<string>('AWS_ENDPOINT') || undefined,
}));
