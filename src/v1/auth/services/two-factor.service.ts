import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import {
  addMinutes,
  isExpired,
  OTP_TTL_MINUTES,
} from 'src/common/utils/date-time.util';
import {
  getMockOtpCode,
  isOtpMockEnabled,
} from 'src/common/utils/otp-mock.util';
import { Admin } from 'src/v1/admin/entities/admin.entity';
import { LogAction } from 'src/v1/log/constants/log-action.enum';
import { AuditLogService } from 'src/v1/log/services/audit-log.service';
import {
  OtpPurpose,
  OtpRecord,
  OtpStatus,
} from 'src/v1/otp/entities/otp-record.entity';
import { Repository } from 'typeorm';
import {
  TWO_FACTOR_CODE_REQUESTED,
  TwoFactorCodeRequestedEvent,
} from '../events/two-factor-code-requested.event';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectRepository(OtpRecord)
    private otpRecordRepository: Repository<OtpRecord>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
  ) {}

  async enableTwoFactor(userId: string, email: string): Promise<void> {
    const user = await this.adminRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.email !== email) {
      throw new BadRequestException('Email does not match user account');
    }

    const code = this.generateVerificationCode();
    const expiresAt = addMinutes(OTP_TTL_MINUTES);

    const otpRecord = this.otpRecordRepository.create({
      adminId: userId,
      purpose: OtpPurpose.TWO_FACTOR,
      code,
      expiresAt,
      status: OtpStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
    });
    await this.otpRecordRepository.save(otpRecord);

    this.eventEmitter.emit(
      TWO_FACTOR_CODE_REQUESTED,
      new TwoFactorCodeRequestedEvent(
        email,
        code,
        user.fullName || user.email,
        this.configService.get<string>('SMTP_FROM_NAME', ''),
        10,
      ),
    );

    await this.auditLogService
      .create({
        adminId: userId,
        action: LogAction.ENABLE_TWO_FACTOR,
        description: '2FA setup initiated, verification code sent',
      })
      .catch((err: unknown) =>
        this.logger.error('Failed to write audit log:', err),
      );

    this.logger.log(`2FA verification code queued for user ${userId}`);
  }

  async verifyTwoFactor(userId: string, code: string): Promise<boolean> {
    const otpRecord = await this.otpRecordRepository.findOne({
      where: {
        adminId: userId,
        purpose: OtpPurpose.TWO_FACTOR,
        status: OtpStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpRecord) {
      throw new BadRequestException(
        'No pending two-factor authentication code found',
      );
    }

    if (isExpired(otpRecord.expiresAt)) {
      otpRecord.status = OtpStatus.EXPIRED;
      await this.otpRecordRepository.save(otpRecord);
      throw new BadRequestException('Verification code has expired');
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      otpRecord.status = OtpStatus.EXPIRED;
      await this.otpRecordRepository.save(otpRecord);
      throw new BadRequestException('Maximum verification attempts exceeded');
    }

    otpRecord.attempts += 1;

    if (otpRecord.code !== code) {
      await this.otpRecordRepository.save(otpRecord);
      throw new BadRequestException('Invalid verification code');
    }

    otpRecord.status = OtpStatus.VERIFIED;
    await this.otpRecordRepository.save(otpRecord);

    await this.adminRepository.update(userId, { isTwoFactorEnabled: true });

    await this.auditLogService
      .create({
        adminId: userId,
        action: LogAction.VERIFY_TWO_FACTOR,
        description: '2FA enabled successfully',
      })
      .catch((err: unknown) =>
        this.logger.error('Failed to write audit log:', err),
      );

    this.logger.log(`2FA enabled for user ${userId}`);
    return true;
  }

  async disableTwoFactor(userId: string, password: string): Promise<void> {
    const user = await this.adminRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!password) {
      throw new BadRequestException('Password is required to disable 2FA');
    }
    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Password does not match');
    }

    await this.otpRecordRepository.update(
      {
        adminId: userId,
        purpose: OtpPurpose.TWO_FACTOR,
        status: OtpStatus.VERIFIED,
      },
      { status: OtpStatus.EXPIRED },
    );

    await this.adminRepository.update(userId, { isTwoFactorEnabled: false });

    await this.auditLogService
      .create({
        adminId: userId,
        action: LogAction.DISABLE_TWO_FACTOR,
        description: '2FA disabled successfully',
      })
      .catch((err: unknown) =>
        this.logger.error('Failed to write audit log:', err),
      );

    this.logger.log(`2FA disabled for user ${userId}`);
  }

  async sendVerificationCode(userId: string): Promise<void> {
    const user = await this.adminRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const existing = await this.otpRecordRepository.findOne({
      where: {
        adminId: userId,
        purpose: OtpPurpose.TWO_FACTOR,
        status: OtpStatus.VERIFIED,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Two-factor verification code is already sent',
      );
    }

    const code = this.generateVerificationCode();
    const expiresAt = addMinutes(OTP_TTL_MINUTES);

    const otpRecord = this.otpRecordRepository.create({
      adminId: userId,
      purpose: OtpPurpose.TWO_FACTOR,
      code,
      expiresAt,
      status: OtpStatus.PENDING,
      attempts: 0,
      maxAttempts: 3,
    });

    await this.otpRecordRepository.save(otpRecord);

    this.eventEmitter.emit(
      TWO_FACTOR_CODE_REQUESTED,
      new TwoFactorCodeRequestedEvent(
        user.email,
        code,
        user.fullName || user.email,
        this.configService.get<string>('SMTP_FROM_NAME', ''),
        10,
      ),
    );

    this.logger.log(`2FA verification code queued for user ${userId}`);
  }

  async validateLoginCode(userId: string, code: string): Promise<boolean> {
    const otpRecord = await this.otpRecordRepository.findOne({
      where: {
        adminId: userId,
        purpose: OtpPurpose.TWO_FACTOR,
        status: OtpStatus.PENDING,
        code,
      },
    });

    if (!otpRecord) {
      return false;
    }

    if (isExpired(otpRecord.expiresAt)) {
      otpRecord.status = OtpStatus.EXPIRED;
      await this.otpRecordRepository.save(otpRecord);
      return false;
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      otpRecord.status = OtpStatus.EXPIRED;
      await this.otpRecordRepository.save(otpRecord);
      return false;
    }

    otpRecord.attempts += 1;

    if (otpRecord.code !== code) {
      await this.otpRecordRepository.save(otpRecord);
      return false;
    }

    otpRecord.status = OtpStatus.USED;
    await this.otpRecordRepository.save(otpRecord);

    return true;
  }

  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    const user = await this.adminRepository.findOne({ where: { id: userId } });
    return user?.isTwoFactorEnabled || false;
  }

  private generateVerificationCode(): string {
    if (isOtpMockEnabled(this.configService)) {
      return getMockOtpCode(this.configService);
    }

    return crypto.randomInt(100000, 999999).toString();
  }
}
