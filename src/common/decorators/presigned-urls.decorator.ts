import { SetMetadata } from '@nestjs/common';

export const PRESIGNED_URLS_KEY = 'presignedUrlFields';

export type PresignedUrlField =
  | string
  | {
      path: string;
      as: string;
    };

export const ResolvePresignedUrls = (...fields: PresignedUrlField[]) =>
  SetMetadata(PRESIGNED_URLS_KEY, fields);
