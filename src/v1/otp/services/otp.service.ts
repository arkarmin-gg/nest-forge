import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import {
  OtpRecord,
  OtpPurpose,
  OtpStatus,
} from '../entities/otp-record.entity';
import {
  addMinutes,
  isExpired,
  OTP_TTL_MINUTES,
} from 'src/common/utils/date-time.util';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpRecord)
    private otpRecordRepository: Repository<OtpRecord>,
  ) {}

  async create(opts: {
    purpose: OtpPurpose;
    code: string;
    userId?: string;
    adminId?: string;
    requestId?: string;
    ttlMinutes?: number;
    maxAttempts?: number;
  }): Promise<OtpRecord> {
    const expiresAt = addMinutes(opts.ttlMinutes ?? OTP_TTL_MINUTES);

    const record = this.otpRecordRepository.create({
      purpose: opts.purpose,
      code: opts.code,
      userId: opts.userId ?? null,
      adminId: opts.adminId ?? null,
      requestId: opts.requestId ?? null,
      expiresAt,
      status: OtpStatus.PENDING,
      attempts: 0,
      maxAttempts: opts.maxAttempts ?? 3,
    });

    return this.otpRecordRepository.save(record);
  }

  async findPending(opts: {
    purpose: OtpPurpose;
    userId?: string;
    adminId?: string;
  }): Promise<OtpRecord | null> {
    return this.otpRecordRepository.findOne({
      where: {
        purpose: opts.purpose,
        status: OtpStatus.PENDING,
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(opts.adminId ? { adminId: opts.adminId } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async verify(record: OtpRecord, code: string): Promise<void> {
    if (isExpired(record.expiresAt)) {
      record.status = OtpStatus.EXPIRED;
      await this.otpRecordRepository.save(record);
      throw new BadRequestException('Verification code has expired');
    }

    if (record.attempts >= record.maxAttempts) {
      record.status = OtpStatus.EXPIRED;
      await this.otpRecordRepository.save(record);
      throw new BadRequestException('Maximum verification attempts exceeded');
    }

    record.attempts += 1;

    if (record.code !== code) {
      await this.otpRecordRepository.save(record);
      throw new BadRequestException('Invalid verification code');
    }

    record.status = OtpStatus.VERIFIED;
    await this.otpRecordRepository.save(record);
  }

  async markUsed(record: OtpRecord): Promise<void> {
    record.status = OtpStatus.USED;
    await this.otpRecordRepository.save(record);
  }

  @Cron('0 2 * * *')
  async cleanupExpiredOtpRecords(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.otpRecordRepository.delete({
      status: In([OtpStatus.EXPIRED, OtpStatus.USED]),
      createdAt: LessThan(cutoff),
    });
    this.logger.log(
      `OTP cleanup: deleted ${result.affected ?? 0} expired/used records older than 7 days`,
    );
  }

  async expireAll(opts: {
    purpose: OtpPurpose;
    status: OtpStatus;
    userId?: string;
    adminId?: string;
  }): Promise<void> {
    await this.otpRecordRepository.update(
      {
        purpose: opts.purpose,
        status: opts.status,
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(opts.adminId ? { adminId: opts.adminId } : {}),
      },
      { status: OtpStatus.EXPIRED },
    );
  }
}
