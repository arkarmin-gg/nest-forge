import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpRecord } from './entities/otp-record.entity';
import { OtpService } from './services/otp.service';

@Module({
  imports: [TypeOrmModule.forFeature([OtpRecord])],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
