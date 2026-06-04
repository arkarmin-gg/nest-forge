import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { PresignedUrlInterceptor } from './interceptors/presigned-url.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { S3ClientUtils } from './utils/s3-client.utils';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Setting } from 'src/modules/setting/entities/setting.entity';
import { EmailServiceUtils } from './utils/email-service.utils';
import { SMSPhoServiceUtils } from './utils/sms-pho-service.utils';
import { FileUploadService } from './services/file-upload.service';
import { StartupService } from './services/startup.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  providers: [
    HttpExceptionFilter,
    S3ClientUtils,
    EmailServiceUtils,
    SMSPhoServiceUtils,
    FileUploadService,
    StartupService,
    { provide: APP_INTERCEPTOR, useClass: PresignedUrlInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
  exports: [
    HttpExceptionFilter,
    S3ClientUtils,
    EmailServiceUtils,
    SMSPhoServiceUtils,
    FileUploadService,
  ],
})
export class CommonModule {}
