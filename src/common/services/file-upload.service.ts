import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3ClientUtils } from '../utils/s3-client.utils';

@Injectable()
export class FileUploadService {
  constructor(private readonly s3ClientUtils: S3ClientUtils) {}

  async uploadProfileImage(
    file: Express.Multer.File,
    path: 'users/profile' | 'admins/profile',
  ): Promise<string | null> {
    const original = file.originalname?.trim() || 'profile';
    const sanitized = original.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const key = `${randomUUID()}-${sanitized}`;

    const res = await this.s3ClientUtils.uploadFile({
      key,
      body: file.buffer,
      contentType: file.mimetype,
      path,
      metadata: { filename: original },
    });

    return res.success && res.key ? res.key : null;
  }

  /**
   * Resolves which profile image URL to persist after an update.
   *
   * Priority: uploaded file > body URL > existing URL.
   * A body URL of '' means "clear the image".
   */
  async resolveProfileImageUrl(opts: {
    file?: Express.Multer.File;
    bodyUrl: string | undefined;
    existingUrl: string;
    s3Path: 'users/profile' | 'admins/profile';
  }): Promise<string> {
    if (opts.file) {
      const uploaded = await this.uploadProfileImage(opts.file, opts.s3Path);
      return uploaded ?? opts.existingUrl;
    }

    if (typeof opts.bodyUrl === 'string') {
      return opts.bodyUrl;
    }

    return opts.existingUrl;
  }

  async replaceProfileImage(newUrl: string, oldUrl: string): Promise<void> {
    if (newUrl !== oldUrl && oldUrl) {
      await this.s3ClientUtils.deleteObject(oldUrl);
    }
  }

  async deleteProfileImage(url: string): Promise<void> {
    if (url) {
      await this.s3ClientUtils.deleteObject(url);
    }
  }
}
