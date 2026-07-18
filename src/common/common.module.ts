import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from 'src/modules/setting/entities/setting.entity';
import { HttpExceptionFilter } from './filters';
import { PresignedUrlInterceptor, ResponseInterceptor } from './interceptors';
import { EmailService } from './services/email.service';
import { FileUploadService } from './services/file-upload.service';
import { S3ClientService } from './services/s3-client.service';
import { SMSPohService } from './services/sms-poh.service';
import { StartupService } from './services/startup.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [
    HttpExceptionFilter,
    S3ClientService,
    EmailService,
    SMSPohService,
    FileUploadService,
    StartupService,
    { provide: APP_INTERCEPTOR, useClass: PresignedUrlInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
  exports: [
    HttpExceptionFilter,
    S3ClientService,
    EmailService,
    SMSPohService,
    FileUploadService,
  ],
})
export class CommonModule {}
