import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getKeyFromPresignedUrl } from '../utils';

@Injectable()
export class S3ClientService {
  private readonly logger = new Logger(S3ClientService.name);
  private readonly s3Client: S3Client | null;
  private readonly bucketName: string | null;

  constructor(private readonly configService: ConfigService) {
    const isEnabled = this.configService.getOrThrow<boolean>('s3.enabled');
    if (!isEnabled) {
      this.s3Client = null;
      this.bucketName = null;
      return;
    }

    const accessKeyId = this.configService.getOrThrow<string>('s3.accessKeyId');
    const secretAccessKey =
      this.configService.getOrThrow<string>('s3.secretAccessKey');
    const region = this.configService.getOrThrow<string>('s3.region');
    const endpoint = this.configService.get<string>('s3.endpoint');

    this.bucketName = this.configService.getOrThrow<string>('s3.bucketName');

    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  private getClient(): { s3Client: S3Client; bucketName: string } {
    if (!this.s3Client || !this.bucketName) {
      throw new InternalServerErrorException('S3 storage is not configured');
    }

    return { s3Client: this.s3Client, bucketName: this.bucketName };
  }

  /**
   * Generate a presigned URL for a file in S3
   */
  async generatePresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string | null> {
    try {
      if (!key || key.trim().length === 0) {
        return null;
      }
      const { s3Client, bucketName } = this.getClient();
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });

      return url;
    } catch (error: unknown) {
      const err = error as Error;
      if (key && key.trim().length > 0) {
        this.logger.error(
          `Failed to generate download URL for ${key}: ${err.message}`,
          err.stack,
        );
      }
      return null;
    }
  }

  /**
   * Check if an object exists in S3
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      if (!key || key.trim().length === 0) {
        return false;
      }
      const { s3Client, bucketName } = this.getClient();
      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      const err = error as Error;
      if (key && key.trim().length > 0) {
        this.logger.error(
          `Failed to check object existence for ${key}: ${err.message}`,
          err.stack,
        );
      }
      return false;
    }
  }

  /**
   * Upload a file to S3
   */
  async uploadFile({
    key,
    body,
    contentType,
    path,
    metadata,
  }: {
    key: string;
    body: Buffer | Uint8Array | string;
    contentType?: string;
    path?: string;
    metadata?: Record<string, string>;
  }): Promise<{ success: boolean; key?: string; error?: string }> {
    try {
      const { s3Client, bucketName } = this.getClient();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `${path}/${key}`,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      });

      await s3Client.send(command);

      this.logger.log(`Successfully uploaded file: ${key}`);
      return { success: true, key: `${path}/${key}` };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to upload file ${key}: ${err.message}`,
        err.stack,
      );
      return { success: false, error: err.message, key: `${path}/${key}` };
    }
  }

  /**
   * Update an existing file in S3
   * Note: This method overwrites the existing file with the new content.
   */
  async updateFile({
    oldKey,
    key,
    body,
    contentType,
    path,
    metadata,
  }: {
    key: string;
    oldKey: string;
    body: Buffer | Uint8Array | string;
    contentType?: string;
    path?: string;
    metadata?: Record<string, string>;
  }): Promise<{ success: boolean; key?: string; error?: string }> {
    const newKey = `${path}/${key}`;
    if (oldKey === key) {
      throw new Error('oldKey and key must be different');
    }

    if (oldKey) {
      if (!(await this.objectExists(oldKey))) {
        throw new Error(`oldKey ${oldKey} does not exist`);
      }
    }

    try {
      const { s3Client, bucketName } = this.getClient();
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: newKey,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      });

      await s3Client.send(command);
      this.logger.log(`Successfully updated file: ${key}`);
      // Delete old data
      await this.deleteObject(oldKey);
      this.logger.log(`Successfully deleted old file: ${oldKey}`);

      return { success: true, key: newKey };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to update file ${key}: ${err.message}`,
        err.stack,
      );
      // When error occur and image is uploaded, rollback and delete new image
      await this.deleteObject(newKey);
      this.logger.error(
        `Rollback: Successfully deleted new uploaded file: ${newKey}`,
      );

      return { success: false, error: err.message, key: newKey };
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteObject(
    key: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!key || key.trim().length === 0) {
        return { success: false, error: 'Key is empty' };
      }
      const { s3Client, bucketName } = this.getClient();
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await s3Client.send(command);

      this.logger.log(`Successfully deleted file: ${key}`);
      return { success: true };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to delete file ${key}: ${err.message}`,
        err.stack,
      );
      return { success: false, error: err.message };
    }
  }

  getKeyFromPresignedUrl(url: string): string | null {
    if (!this.bucketName) {
      return null;
    }

    return getKeyFromPresignedUrl(url, this.bucketName);
  }
}
