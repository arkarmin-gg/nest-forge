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
  getMockOtpCode,
  isOtpMockEnabled,
} from 'src/common/utils/otp-mock.util';
import { Request } from 'express';
import { buildRequestContext } from 'src/common/utils/request-context.util';
import { Admin } from 'src/modules/admin';
import { OtpPurpose, OtpStatus } from 'src/modules/otp';
import { OtpService } from 'src/modules/otp/api';
import { Repository } from 'typeorm';
import {
  TWO_FACTOR_CODE_REQUESTED,
  TwoFactorCodeRequestedEvent,
} from '../events/two-factor-code-requested.event';
import { AUDIT_LOG_EVENT, AuditLogEvent, LogStatus } from 'src/modules/log';
import { LogAction } from 'src/modules/log/api';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private otpService: OtpService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
  ) {}

  async enableTwoFactor(userId: string, email: string): Promise<void> {
    const admin = await this.adminRepository.findOne({ where: { id: userId } });
    if (!admin) {
      throw new BadRequestException('User not found');
    }

    if (admin.email !== email) {
      throw new BadRequestException('Email does not match user account');
    }

    const code = this.generateVerificationCode();
    await this.otpService.create({
      adminId: userId,
      purpose: OtpPurpose.TWO_FACTOR,
      code,
    });

    this.eventEmitter.emit(
      TWO_FACTOR_CODE_REQUESTED,
      new TwoFactorCodeRequestedEvent(
        email,
        code,
        admin.fullName || admin.email,
        this.configService.get<string>('SMTP_FROM_NAME', ''),
        10,
      ),
    );

    this.logger.log(`2FA verification code queued for user ${userId}`);
  }

  async verifyTwoFactor(
    userId: string,
    code: string,
    request: Request,
  ): Promise<boolean> {
    const record = await this.otpService.findPending({
      adminId: userId,
      purpose: OtpPurpose.TWO_FACTOR,
    });

    if (!record) {
      throw new BadRequestException(
        'No pending two-factor authentication code found',
      );
    }

    await this.otpService.verify(record, code);
    await this.adminRepository.update(userId, { isTwoFactorEnabled: true });

    this.logger.log(`2FA enabled for user ${userId}`);

    this.eventEmitter.emit(
      AUDIT_LOG_EVENT,
      new AuditLogEvent({
        adminId: userId,
        action: LogAction.ENABLE_TWO_FACTOR,
        description: 'Two-factor authentication enabled',
        entityName: 'Admin',
        entityId: userId,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      }),
    );

    return true;
  }

  async disableTwoFactor(userId: string, password: string): Promise<void> {
    const admin = await this.adminRepository.findOne({ where: { id: userId } });
    if (!admin) {
      throw new BadRequestException('User not found');
    }

    if (!password) {
      throw new BadRequestException('Password is required to disable 2FA');
    }
    if (!(await bcrypt.compare(password, admin.password))) {
      throw new UnauthorizedException('Password does not match');
    }

    await this.otpService.expireAll({
      adminId: userId,
      purpose: OtpPurpose.TWO_FACTOR,
      status: OtpStatus.VERIFIED,
    });

    await this.adminRepository.update(userId, { isTwoFactorEnabled: false });

    this.logger.log(`2FA disabled for user ${userId}`);
  }

  async sendVerificationCode(userId: string): Promise<void> {
    const admin = await this.adminRepository.findOne({ where: { id: userId } });
    if (!admin) {
      throw new BadRequestException('User not found');
    }

    const existing = await this.otpService.findOneByStatus({
      adminId: userId,
      purpose: OtpPurpose.TWO_FACTOR,
      status: OtpStatus.VERIFIED,
    });

    if (existing) {
      throw new BadRequestException(
        'Two-factor verification code is already sent',
      );
    }

    const code = this.generateVerificationCode();
    await this.otpService.create({
      adminId: userId,
      purpose: OtpPurpose.TWO_FACTOR,
      code,
    });

    this.eventEmitter.emit(
      TWO_FACTOR_CODE_REQUESTED,
      new TwoFactorCodeRequestedEvent(
        admin.email,
        code,
        admin.fullName || admin.email,
        this.configService.get<string>('SMTP_FROM_NAME', ''),
        10,
      ),
    );

    this.logger.log(`2FA verification code queued for user ${userId}`);
  }

  async validateLoginCode(userId: string, code: string): Promise<boolean> {
    return this.otpService.validateLoginCode({
      adminId: userId,
      purpose: OtpPurpose.TWO_FACTOR,
      code,
    });
  }

  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    const admin = await this.adminRepository.findOne({ where: { id: userId } });
    return admin?.isTwoFactorEnabled || false;
  }

  private generateVerificationCode(): string {
    if (isOtpMockEnabled(this.configService)) {
      return getMockOtpCode(this.configService);
    }

    return crypto.randomInt(100000, 999999).toString();
  }
}
