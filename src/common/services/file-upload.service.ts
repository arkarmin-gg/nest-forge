import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3ClientService } from './s3-client.service';

@Injectable()
export class FileUploadService {
  constructor(private readonly s3ClientService: S3ClientService) {}

  async upload(
    file: Express.Multer.File,
    path: string,
  ): Promise<string | null> {
    const original = file.originalname?.trim() || 'file';
    const sanitized = original.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const key = `${randomUUID()}-${sanitized}`;

    const res = await this.s3ClientService.uploadFile({
      key,
      body: file.buffer,
      contentType: file.mimetype,
      path,
      metadata: { filename: original },
    });

    return res.success && res.key ? res.key : null;
  }

  /**
   * Resolves which file URL to persist after an update.
   *
   * Priority: uploaded file > body URL > existing URL.
   * A body URL of '' means "clear the file".
   */
  async resolveUrl(opts: {
    file?: Express.Multer.File;
    bodyUrl: string | undefined;
    existingUrl: string;
    path: string;
  }): Promise<string> {
    if (opts.file) {
      const uploaded = await this.upload(opts.file, opts.path);
      return uploaded ?? opts.existingUrl;
    }

    if (typeof opts.bodyUrl === 'string') {
      return opts.bodyUrl;
    }

    return opts.existingUrl;
  }

  async replace(newUrl: string, oldUrl: string): Promise<void> {
    if (newUrl !== oldUrl && oldUrl) {
      await this.s3ClientService.deleteObject(oldUrl);
    }
  }

  async remove(url: string): Promise<void> {
    if (url) {
      await this.s3ClientService.deleteObject(url);
    }
  }
}
