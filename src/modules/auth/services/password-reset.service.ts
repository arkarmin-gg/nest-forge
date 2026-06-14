import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { Request } from 'express';
import { EmailServiceUtils } from 'src/common/utils/email-service.utils';
import {
  getMockOtpCode,
  isOtpMockEnabled,
} from 'src/common/utils/otp-mock.util';
import { buildRequestContext } from 'src/common/utils/request-context.util';
import { SMSPhoServiceUtils } from 'src/common/utils/sms-pho-service.utils';
import { Admin } from 'src/modules/admin';
import { OtpPurpose } from 'src/modules/otp';
import { OtpService } from 'src/modules/otp/api';
import { User } from 'src/modules/user';
import { Repository } from 'typeorm';
import { ForgotPasswordSendOTPDto } from '../dto/forgot-password-send-otp.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { UserForgotPasswordSendOTPDto } from '../dto/user-forgot-password-send-otp.dto';
import { VerifyPasswordResetOTPCodeDto } from '../dto/verify-password-reset-otp-code.dto';
import { TokenService } from './token.service';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private otpService: OtpService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailServiceUtils: EmailServiceUtils,
    private smsPhoServiceUtils: SMSPhoServiceUtils,
    private tokenService: TokenService,
  ) {}

  private generateCode(): string {
    if (isOtpMockEnabled(this.configService)) {
      return getMockOtpCode(this.configService);
    }
    return crypto.randomInt(100000, 999999).toString();
  }

  async passwordResetOTPSend(dto: ForgotPasswordSendOTPDto, request: Request) {
    const { email } = dto;

    const admin = await this.adminRepository.findOne({ where: { email } });
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

    await this.emailServiceUtils.sendForgotPasswordResetCode({
      code,
      email: admin.email,
      userName: admin.fullName,
      fromUsername: this.configService.get<string>('SMTP_FROM_NAME', ''),
      expiresIn: 10,
    });

    this.logger.log(
      `Admin with ID '${admin.id}' sent forgot password OTP successfully`,
    );
    return { userId: admin.id };
  }

  async verifyPasswordResetOTPCode(dto: VerifyPasswordResetOTPCodeDto) {
    const record = await this.otpService.findPendingByAnySubject(
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

  async resetPassword(dto: ResetPasswordDto, request: Request) {
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

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      const admin = await this.adminRepository.findOne({
        where: { id: userId },
      });

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
      await this.adminRepository.save(admin);

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
    await this.userRepository.save(user);

    this.logger.log(`User with ID '${user.id}' changed password successfully`);
  }

  async userPasswordResetOTPSend(
    dto: UserForgotPasswordSendOTPDto,
    request: Request,
  ) {
    const { phone } = dto;
    const user = await this.userRepository.findOne({ where: { phone } });

    if (!user) {
      this.logger.warn(`User with phone '${phone}' not found`);
      throw new NotFoundException(`User with phone '${phone}' not found`);
    }

    const smsResponse = await this.smsPhoServiceUtils.sendOTP({
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

  async userVerifyPasswordResetOTPCode(dto: VerifyPasswordResetOTPCodeDto) {
    const { userId, code } = dto;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User with ID '${userId}' not found`);
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    await this.otpService.verifySmsOtp(
      { userId, purpose: OtpPurpose.RESET_PASSWORD },
      code,
      (requestId, otpCode) =>
        this.smsPhoServiceUtils.verifyOTP({ requestId, code: otpCode }),
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

  async userResetPassword(dto: ResetPasswordDto, request: Request) {
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
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(
        `Account with ID '${userId}' not found after token verification`,
      );
    }

    user.password = dto.newPassword;
    await this.userRepository.save(user);
    await this.tokenService.revokeAllUserTokens(userId);

    this.logger.log(`User with ID '${user.id}' changed password successfully`);
  }
}
