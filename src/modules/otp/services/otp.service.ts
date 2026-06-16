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
import { sha256Hex } from 'src/common/utils/hash.util';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpRecord)
    private readonly otpRecordRepository: Repository<OtpRecord>,
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
      codeHash: sha256Hex(opts.code),
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
    // codeHash is `select: false`; re-select it because verify() compares it.
    const qb = this.otpRecordRepository
      .createQueryBuilder('otp')
      .addSelect('otp.codeHash')
      .where('otp.purpose = :purpose', { purpose: opts.purpose })
      .andWhere('otp.status = :status', { status: OtpStatus.PENDING })
      .orderBy('otp.createdAt', 'DESC');

    if (opts.userId) {
      qb.andWhere('otp.userId = :userId', { userId: opts.userId });
    }
    if (opts.adminId) {
      qb.andWhere('otp.adminId = :adminId', { adminId: opts.adminId });
    }

    return qb.getOne();
  }

  async findOneByStatus(opts: {
    purpose: OtpPurpose;
    status: OtpStatus;
    userId?: string;
    adminId?: string;
  }): Promise<OtpRecord | null> {
    return this.otpRecordRepository.findOne({
      where: {
        purpose: opts.purpose,
        status: opts.status,
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(opts.adminId ? { adminId: opts.adminId } : {}),
      },
    });
  }

  /**
   * Tries subjectId as userId first, then adminId. Used when the caller
   * doesn't know whether the subject is a User or Admin.
   */
  async findPendingByAnySubject(
    subjectId: string,
    purpose: OtpPurpose,
  ): Promise<OtpRecord | null> {
    // codeHash is `select: false`; re-select it because verify() compares it.
    const byUser = await this.otpRecordRepository
      .createQueryBuilder('otp')
      .addSelect('otp.codeHash')
      .where('otp.userId = :subjectId', { subjectId })
      .andWhere('otp.purpose = :purpose', { purpose })
      .andWhere('otp.status = :status', { status: OtpStatus.PENDING })
      .getOne();
    if (byUser) return byUser;

    return this.otpRecordRepository
      .createQueryBuilder('otp')
      .addSelect('otp.codeHash')
      .where('otp.adminId = :subjectId', { subjectId })
      .andWhere('otp.purpose = :purpose', { purpose })
      .andWhere('otp.status = :status', { status: OtpStatus.PENDING })
      .getOne();
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

    if (record.codeHash !== sha256Hex(code)) {
      await this.otpRecordRepository.save(record);
      throw new BadRequestException('Invalid verification code');
    }

    record.status = OtpStatus.VERIFIED;
    await this.otpRecordRepository.save(record);
  }

  /**
   * Non-throwing login code validation. Returns false on any failure,
   * marks the record as USED on success. Used for 2FA login challenge.
   */
  async validateLoginCode(opts: {
    adminId: string;
    purpose: OtpPurpose;
    code: string;
  }): Promise<boolean> {
    const codeHash = sha256Hex(opts.code);

    // codeHash is `select: false`; re-select it because it is compared below.
    const record = await this.otpRecordRepository
      .createQueryBuilder('otp')
      .addSelect('otp.codeHash')
      .where('otp.adminId = :adminId', { adminId: opts.adminId })
      .andWhere('otp.purpose = :purpose', { purpose: opts.purpose })
      .andWhere('otp.status = :status', { status: OtpStatus.PENDING })
      .andWhere('otp.codeHash = :codeHash', { codeHash })
      .getOne();

    if (!record) return false;

    if (isExpired(record.expiresAt)) {
      record.status = OtpStatus.EXPIRED;
      await this.otpRecordRepository.save(record);
      return false;
    }

    if (record.attempts >= record.maxAttempts) {
      record.status = OtpStatus.EXPIRED;
      await this.otpRecordRepository.save(record);
      return false;
    }

    record.attempts += 1;

    if (record.codeHash !== codeHash) {
      await this.otpRecordRepository.save(record);
      return false;
    }

    record.status = OtpStatus.USED;
    await this.otpRecordRepository.save(record);
    return true;
  }

  /**
   * Verifies an SMS-based OTP where the actual code check is delegated to
   * an external SMS provider via verifyFn. Handles all expiry/attempt logic
   * and marks the record VERIFIED on success.
   */
  async verifySmsOtp(
    opts: { userId?: string; adminId?: string; purpose: OtpPurpose },
    code: string,
    verifyFn: (requestId: string, code: string) => Promise<unknown>,
  ): Promise<{ record: OtpRecord }> {
    const record = await this.findPending(opts);
    if (!record) {
      throw new BadRequestException('Invalid verification code');
    }

    if (isExpired(record.expiresAt)) {
      record.status = OtpStatus.EXPIRED;
      await this.otpRecordRepository.save(record);
      throw new BadRequestException('Verification code expired');
    }

    if (record.attempts >= record.maxAttempts) {
      record.status = OtpStatus.EXPIRED;
      await this.otpRecordRepository.save(record);
      throw new BadRequestException('Maximum verification attempts exceeded');
    }

    record.attempts += 1;

    if (!record.requestId) {
      await this.otpRecordRepository.save(record);
      throw new BadRequestException('Invalid verification code');
    }

    try {
      await verifyFn(record.requestId, code);
    } catch {
      await this.otpRecordRepository.save(record);
      throw new BadRequestException('Invalid verification code');
    }

    record.status = OtpStatus.VERIFIED;
    record.codeHash = sha256Hex(code);
    await this.otpRecordRepository.save(record);
    return { record };
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
