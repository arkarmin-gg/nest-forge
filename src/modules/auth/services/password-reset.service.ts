import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { Request } from 'express';
import { getMockOtpCode, isOtpMockEnabled } from 'src/common/utils';
import { SMSPohService } from 'src/common/services';
import { AdminService } from 'src/modules/admin/api';
import { OtpPurpose } from 'src/modules/otp';
import { OtpService } from 'src/modules/otp/api';
import { UserService } from 'src/modules/user/api';
import { ForgotPasswordSendOTPDto } from '../dto/forgot-password-send-otp.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { UserForgotPasswordSendOTPDto } from '../dto/user-forgot-password-send-otp.dto';
import { VerifyPasswordResetOTPCodeDto } from '../dto/verify-password-reset-otp-code.dto';
import {
  FORGOT_PASSWORD_CODE_REQUESTED,
  ForgotPasswordCodeRequestedEvent,
} from '../events/forgot-password-code-requested.event';
import { TokenService } from './token.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly userService: UserService,
    private readonly adminService: AdminService,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly smsPohService: SMSPohService,
    private readonly tokenService: TokenService,
  ) {}

  private generateCode(): string {
    if (isOtpMockEnabled(this.configService)) {
      return getMockOtpCode(this.configService);
    }
    return crypto.randomInt(100000, 999999).toString();
  }

  async passwordResetOTPSend(
    dto: ForgotPasswordSendOTPDto,
    _request: Request,
  ): Promise<{ userId: string }> {
    const { email } = dto;

    const admin = await this.adminService.findByEmail(email);
    if (!admin) {
      this.logger.warn(`Admin with email '${email}' not found`);
      throw new NotFoundException(`Admin with email '${email}' not found`);
    }

    const code = this.generateCode();
    await this.otpService.create({
      adminId: admin.id,
      purpose: OtpPurpose.RESET_PASSWORD,
      code,
    });

    this.eventEmitter.emit(
      FORGOT_PASSWORD_CODE_REQUESTED,
      new ForgotPasswordCodeRequestedEvent(
        admin.email,
        code,
        admin.fullName,
        this.configService.get<string>('SMTP_FROM_NAME', ''),
        10,
      ),
    );

    this.logger.log(
      `Admin with ID '${admin.id}' sent forgot password OTP successfully`,
    );
    return { userId: admin.id };
  }

  async verifyPasswordResetOTPCode(
    dto: VerifyPasswordResetOTPCodeDto,
  ): Promise<{ userId: string; accessToken: string }> {
    const record = await this.otpService.findPendingOTPByAnySubject(
      dto.userId,
      OtpPurpose.RESET_PASSWORD,
    );

    if (!record) {
      this.logger.warn(
        `No pending OTP record found for account ID '${dto.userId}'`,
      );
      throw new BadRequestException('No pending otp verification found');
    }

    await this.otpService.verify(record, dto.code);

    const accessToken = this.jwtService.sign({
      sub: dto.userId,
      userId: dto.userId,
      type: OtpPurpose.RESET_PASSWORD,
    });

    this.logger.log(
      `Account with ID '${dto.userId}' verified reset password OTP successfully`,
    );
    return { userId: dto.userId, accessToken };
  }

  async resetPassword(dto: ResetPasswordDto, _request: Request): Promise<void> {
    try {
      await this.jwtService.verifyAsync(dto.accessToken);
    } catch {
      throw new UnauthorizedException('Access token verification failed');
    }

    const decoded = this.jwtService.decode(dto.accessToken);

    if (!decoded?.userId) {
      throw new BadRequestException('Invalid reset password token');
    }

    const { userId, type } = decoded;

    const user = await this.userService.findByIdNullable(userId);

    if (!user) {
      const admin = await this.adminService.findByIdNullable(userId);

      if (!admin) {
        this.logger.warn(
          `Account with ID '${userId}' not found after token verification`,
        );
        throw new NotFoundException(
          `Account with ID '${userId}' not found after token verification`,
        );
      }

      if (type !== OtpPurpose.RESET_PASSWORD) {
        throw new BadRequestException(
          `Invalid access token type for account ID '${userId}'`,
        );
      }

      admin.password = dto.newPassword;
      await this.adminService.saveEntity(admin);

      this.logger.log(
        `Admin with ID '${admin.id}' changed password successfully`,
      );
      return;
    }

    if (type !== OtpPurpose.RESET_PASSWORD) {
      throw new NotFoundException(
        `Invalid access token type for account ID '${userId}'`,
      );
    }

    user.password = dto.newPassword;
    await this.userService.saveEntity(user);

    this.logger.log(`User with ID '${user.id}' changed password successfully`);
  }

  async userPasswordResetOTPSend(
    dto: UserForgotPasswordSendOTPDto,
    _request: Request,
  ): Promise<{ userId: string }> {
    const { phone } = dto;
    const user = await this.userService.findByPhone(phone);

    if (!user) {
      this.logger.warn(`User with phone '${phone}' not found`);
      throw new NotFoundException(`User with phone '${phone}' not found`);
    }

    const smsResponse = await this.smsPohService.sendOTP({
      to: user.phone,
      message:
        "[{brand}] Dear customer, your OTP code is {code} for password reset. It'll expire in 30 minutes.",
    });

    await this.otpService.create({
      userId: user.id,
      purpose: OtpPurpose.RESET_PASSWORD,
      code: 'SMS_OTP',
      requestId: smsResponse.requestId ?? undefined,
    });

    this.logger.log(
      `User with ID '${user.id}' sent SMS forgot password OTP successfully`,
    );
    return { userId: user.id };
  }

  async userVerifyPasswordResetOTPCode(
    dto: VerifyPasswordResetOTPCodeDto,
  ): Promise<{ userId: string; accessToken: string }> {
    const { userId, code } = dto;

    const user = await this.userService.findByIdNullable(userId);
    if (!user) {
      this.logger.warn(`User with ID '${userId}' not found`);
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    await this.otpService.verifySmsOtp(
      { userId, purpose: OtpPurpose.RESET_PASSWORD },
      code,
      (requestId, otpCode) =>
        this.smsPohService.verifyOTP({ requestId, code: otpCode }),
    );

    const accessToken = this.jwtService.sign({
      sub: userId,
      userId,
      type: OtpPurpose.RESET_PASSWORD,
    });

    this.logger.log(
      `User with ID '${userId}' verified SMS password reset OTP successfully`,
    );
    return { userId, accessToken };
  }

  async userResetPassword(
    dto: ResetPasswordDto,
    _request: Request,
  ): Promise<void> {
    try {
      await this.jwtService.verifyAsync(dto.accessToken);
    } catch {
      throw new UnauthorizedException('Access token verification failed');
    }

    const decoded = this.jwtService.decode(dto.accessToken);

    if (!decoded?.userId || decoded.type !== OtpPurpose.RESET_PASSWORD) {
      throw new BadRequestException('Invalid reset password token');
    }

    const { userId } = decoded;
    const user = await this.userService.findByIdNullable(userId);

    if (!user) {
      throw new NotFoundException(
        `Account with ID '${userId}' not found after token verification`,
      );
    }

    user.password = dto.newPassword;
    await this.userService.saveEntity(user);
    await this.tokenService.revokeAllUserTokens(userId);

    this.logger.log(`User with ID '${user.id}' changed password successfully`);
  }
}
