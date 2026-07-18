import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Cron } from '@nestjs/schedule';
import { addMinutes, isExpired, OTP_TTL_MINUTES } from 'src/common/utils';
import { sha256Hex } from 'src/common/utils';
import { Brackets, In, LessThan } from 'typeorm';
import { OtpPurpose } from '../enums/otp-purpose.enum';
import { OtpStatus } from '../enums/otp-status.enum';
import { OtpRecord } from '../entities/otp-record.entity';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
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

    const record = this.txHost.tx.create(OtpRecord, {
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

    return this.txHost.tx.save(OtpRecord, record);
  }

  async findPending(opts: {
    purpose: OtpPurpose;
    userId?: string;
    adminId?: string;
  }): Promise<OtpRecord | null> {
    // codeHash is `select: false`; re-select it because verify() compares it.
    const qb = this.txHost.tx
      .getRepository(OtpRecord)
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
    return this.txHost.tx.findOne(OtpRecord, {
      where: {
        purpose: opts.purpose,
        status: opts.status,
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(opts.adminId ? { adminId: opts.adminId } : {}),
      },
    });
  }

  async findPendingOTPByAnySubject(
    subjectId: string,
    purpose: OtpPurpose,
  ): Promise<OtpRecord | null> {
    return this.txHost.tx
      .getRepository(OtpRecord)
      .createQueryBuilder('otp')
      .addSelect('otp.codeHash')
      .where(
        new Brackets((qb) => {
          qb.where('otp.userId = :subjectId', { subjectId }).orWhere(
            'otp.adminId = :subjectId',
            { subjectId },
          );
        }),
      )
      .andWhere('otp.purpose = :purpose', { purpose })
      .andWhere('otp.status = :status', {
        status: OtpStatus.PENDING,
      })
      .orderBy('otp.createdAt', 'DESC')
      .addOrderBy('otp.id', 'DESC')
      .getOne();
  }

  async verify(record: OtpRecord, code: string): Promise<void> {
    if (isExpired(record.expiresAt)) {
      record.status = OtpStatus.EXPIRED;
      await this.saveRecord(record);
      throw new BadRequestException('Verification code has expired');
    }

    if (record.attempts >= record.maxAttempts) {
      record.status = OtpStatus.EXPIRED;
      await this.saveRecord(record);
      throw new BadRequestException('Maximum verification attempts exceeded');
    }

    record.attempts += 1;

    if (record.codeHash !== sha256Hex(code)) {
      await this.saveRecord(record);
      throw new BadRequestException('Invalid verification code');
    }

    record.status = OtpStatus.VERIFIED;
    await this.saveRecord(record);
  }

  async validateLoginCode(opts: {
    adminId: string;
    purpose: OtpPurpose;
    code: string;
  }): Promise<boolean> {
    const codeHash = sha256Hex(opts.code);

    const record = await this.txHost.tx
      .getRepository(OtpRecord)
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
      await this.saveRecord(record);
      return false;
    }

    if (record.attempts >= record.maxAttempts) {
      record.status = OtpStatus.EXPIRED;
      await this.saveRecord(record);
      return false;
    }

    record.attempts += 1;

    if (record.codeHash !== codeHash) {
      await this.saveRecord(record);
      return false;
    }

    record.status = OtpStatus.USED;
    await this.saveRecord(record);
    return true;
  }

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
      await this.saveRecord(record);
      throw new BadRequestException('Verification code expired');
    }

    if (record.attempts >= record.maxAttempts) {
      record.status = OtpStatus.EXPIRED;
      await this.saveRecord(record);
      throw new BadRequestException('Maximum verification attempts exceeded');
    }

    record.attempts += 1;

    if (!record.requestId) {
      await this.saveRecord(record);
      throw new BadRequestException('Invalid verification code');
    }

    try {
      await verifyFn(record.requestId, code);
    } catch {
      await this.saveRecord(record);
      throw new BadRequestException('Invalid verification code');
    }

    record.status = OtpStatus.VERIFIED;
    record.codeHash = sha256Hex(code);
    await this.saveRecord(record);
    return { record };
  }

  async markUsed(record: OtpRecord): Promise<void> {
    record.status = OtpStatus.USED;
    await this.saveRecord(record);
  }

  @Cron('0 2 * * *')
  async cleanupExpiredOtpRecords(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.txHost.tx.delete(OtpRecord, {
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
    await this.txHost.tx.update(
      OtpRecord,
      {
        purpose: opts.purpose,
        status: opts.status,
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(opts.adminId ? { adminId: opts.adminId } : {}),
      },
      { status: OtpStatus.EXPIRED },
    );
  }

  private async saveRecord(record: OtpRecord): Promise<OtpRecord> {
    return this.txHost.tx.save(OtpRecord, record);
  }
}
