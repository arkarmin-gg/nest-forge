import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

const ALLOWED_IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export const imageInterceptorOptions: Parameters<
  typeof import('@nestjs/platform-express').FileInterceptor
>[1] = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!file?.mimetype || !ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
      return cb(
        new BadRequestException(
          'Only JPEG, PNG, WEBP, or GIF images are allowed',
        ),
        false,
      );
    }
    cb(null, true);
  },
};
