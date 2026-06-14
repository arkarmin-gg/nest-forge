import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import * as appleSignin from 'apple-signin-auth';
import * as bcrypt from 'bcryptjs';
import { Request } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { FileUploadService } from 'src/common/services/file-upload.service';
import { nowUtc } from 'src/common/utils/date-time.util';
import { buildRequestContext } from 'src/common/utils/request-context.util';
import { SMSPhoServiceUtils } from 'src/common/utils/sms-pho-service.utils';
import {
  ACTIVITY_LOG_EVENT,
  ActivityLogEvent,
  LogStatus,
} from 'src/modules/log';
import { LogAction } from 'src/modules/log/api';
import { LoginProvider, User, UserRegistrationStage } from 'src/modules/user';
import { UserService } from 'src/modules/user/api';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserAppleLoginDto } from '../dto/user-apple-login.dto';
import { UserGoogleLoginDto } from '../dto/user-google-login.dto';
import { UserLoginDto } from '../dto/user-login.dto';
import { UserRegisterAccountSetupDto } from '../dto/user-register-account-setup.dto';
import { UserRegisterOTPRequestDto } from '../dto/user-register-otp-request.dto';
import { UserRegisterOTPVerifyDto } from '../dto/user-register-otp-verify.dto';
import { UserRegisterPasswordSetupDto } from '../dto/user-register-password-setup.dto';
import { AuthenticatedUser, JwtPayload } from '../interfaces/user.interface';
import { TokenService } from './token.service';

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);

  constructor(
    private userService: UserService,
    private tokenService: TokenService,
    private smsPhoServiceUtils: SMSPhoServiceUtils,
    private fileUploadService: FileUploadService,
    private configService: ConfigService,
    private jwtService: JwtService,
    private eventEmitter: EventEmitter2,
  ) {}

  async validateUserById(id: string): Promise<User | null> {
    return this.userService.findByIdNullable(id);
  }

  private async completeUserLogin(user: User, request: Request) {
    const payload: JwtPayload = {
      sub: user.id,
      subjectType: 'USER',
      userId: user.id,
    };

    const accessToken = this.jwtService.sign(payload);
    await this.tokenService.revokeAllUserTokens(user.id, false);
    const refreshToken = await this.tokenService.generateRefreshToken(
      user.id,
      'user',
    );

    this.logger.log(`User with ID '${user.id}' logged in successfully`);

    this.eventEmitter.emit(
      ACTIVITY_LOG_EVENT,
      new ActivityLogEvent({
        userId: user.id,
        action: LogAction.LOGIN,
        description: 'User logged in',
        resourceType: 'Auth',
        resourceId: user.id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      }),
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: this.configService.get<number>(
        'JWT_EXPIRATION',
        900000,
      ),
      refreshTokenExpiresAt: this.configService.get<number>(
        'JWT_REFRESH_EXPIRATION',
        2592000000,
      ),
      user: { id: user.id, fcmToken: user.fcmToken },
    };
  }

  async userLogin(loginDto: UserLoginDto, request: Request) {
    const user = await this.userService.findByPhone(loginDto.phone);

    if (!user || !user.password) {
      this.logger.warn(
        `Invalid login attempt for phone '${loginDto.phone}' (user not found or no password)`,
      );
      this.eventEmitter.emit(
        ACTIVITY_LOG_EVENT,
        new ActivityLogEvent({
          userId: 'unknown',
          action: LogAction.LOGIN,
          description: 'User login failed',
          resourceType: 'Auth',
          status: LogStatus.FAILURE,
          ...buildRequestContext(request),
        }),
      );
      throw new UnauthorizedException('Invalid phone or password');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      this.logger.warn(
        `Invalid login attempt for phone '${loginDto.phone}' (incorrect password)`,
      );
      this.eventEmitter.emit(
        ACTIVITY_LOG_EVENT,
        new ActivityLogEvent({
          userId: user.id,
          action: LogAction.LOGIN,
          description: 'User login failed',
          resourceType: 'Auth',
          resourceId: user.id,
          status: LogStatus.FAILURE,
          ...buildRequestContext(request),
        }),
      );
      throw new UnauthorizedException('Invalid phone or password');
    }

    if (user.isBanned) {
      this.logger.warn(`Banned user with ID '${user.id}' attempted to login`);
      this.eventEmitter.emit(
        ACTIVITY_LOG_EVENT,
        new ActivityLogEvent({
          userId: user.id,
          action: LogAction.LOGIN,
          description: 'User login failed — account banned',
          resourceType: 'Auth',
          resourceId: user.id,
          status: LogStatus.FAILURE,
          ...buildRequestContext(request),
        }),
      );
      throw new UnauthorizedException('Your account has been banned');
    }

    user.fcmToken = loginDto.fcmToken ?? user.fcmToken;
    user.lastLoginAt = nowUtc();
    await this.userService.saveEntity(user);

    return this.completeUserLogin(user, request);
  }

  private async handleOAuthLogin(
    provider: 'GOOGLE' | 'APPLE',
    providerId: string,
    email: string | undefined,
    fullName: string | undefined,
    fcmToken: string | undefined,
    request: Request,
  ) {
    const idField = provider === 'GOOGLE' ? 'googleId' : 'appleId';

    let user = await this.userService.findByOAuth(provider, providerId, email);

    if (!user) {
      user = await this.userService.createEntity({
        [idField]: providerId,
        email,
        fullName: fullName ?? undefined,
        registrationStage: UserRegistrationStage.PASSWORD_SET,
        fcmToken: fcmToken ?? null,
        loginProvider: LoginProvider[provider],
        lastLoginAt: nowUtc(),
      });

      return {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        currentUserRegistrationStage: user.registrationStage,
        nextUserRegistrationStage: UserRegistrationStage.COMPLETED,
        message: `${provider} OAuth successful and account setup required to complete the register process`,
      };
    }

    if (user.isBanned) {
      this.logger.warn(`Banned user with ID '${user.id}' attempted to login`);
      throw new UnauthorizedException('Your account has been banned');
    }

    if (!user[idField as keyof User]) {
      await this.userService.updateFields(user.id, { [idField]: providerId });
    }

    if (fcmToken) user.fcmToken = fcmToken;

    if (user.registrationStage === UserRegistrationStage.PASSWORD_SET) {
      await this.userService.saveEntity(user);
      return {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        currentUserRegistrationStage: user.registrationStage,
        nextUserRegistrationStage: UserRegistrationStage.COMPLETED,
        message: `${provider} OAuth successful and account setup required to complete the register process`,
      };
    }

    user.lastLoginAt = nowUtc();
    await this.userService.saveEntity(user);

    return this.completeUserLogin(user, request);
  }

  async userGoogleLogin(dto: UserGoogleLoginDto, request: Request) {
    const { token, fcmToken } = dto;

    const client = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
    const ticket = await client
      .verifyIdToken({
        idToken: token,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      })
      .catch(() => {
        throw new UnauthorizedException('Invalid Google token');
      });

    const payload = ticket.getPayload();
    if (!payload?.sub) throw new UnauthorizedException('Invalid Google token');

    return this.handleOAuthLogin(
      'GOOGLE',
      payload.sub,
      payload.email,
      payload.name,
      fcmToken,
      request,
    );
  }

  async userAppleLogin(dto: UserAppleLoginDto, request: Request) {
    const { token, fcmToken } = dto;

    const claims = await appleSignin
      .verifyIdToken(token, {
        audience: this.configService.get<string>('APPLE_CLIENT_ID'),
        ignoreExpiration: false,
      })
      .catch(() => {
        throw new UnauthorizedException('Invalid Apple token');
      });

    if (!claims?.sub) throw new UnauthorizedException('Invalid Apple token');

    return this.handleOAuthLogin(
      'APPLE',
      claims.sub,
      claims.email,
      undefined,
      fcmToken,
      request,
    );
  }

  async userRegisterOTPRequest(dto: UserRegisterOTPRequestDto) {
    const existing = await this.userService.findByPhoneAndStage(
      dto.phone,
      UserRegistrationStage.COMPLETED,
    );

    if (existing) {
      this.logger.warn(`User with phone '${dto.phone}' already exists`);
      throw new UnauthorizedException('User already exists');
    }

    const { success, requestId } = await this.smsPhoServiceUtils.sendOTP({
      to: dto.phone,
      message:
        "[{brand}] Dear customer, your OTP code is {code} for register. It'll expire in 30 minutes.",
      ttl: 1800,
      pinLength: 6,
    });

    if (!success) {
      throw new InternalServerErrorException('Failed to send OTP Verification');
    }

    return { requestId, message: 'OTP verification code sent to your phone' };
  }

  async userRegisterOTPVerify(dto: UserRegisterOTPVerifyDto) {
    const user = await this.userService.findByPhone(dto.phone);

    if (user) {
      if (user.registrationStage === UserRegistrationStage.OTP_VERIFIED) {
        return {
          userId: user.id,
          currentUserRegistrationStage: user.registrationStage,
          nextUserRegistrationStage: UserRegistrationStage.PASSWORD_SET,
          message: 'User is already OTP_VERIFY',
        };
      }

      if (user.registrationStage === UserRegistrationStage.PASSWORD_SET) {
        return {
          userId: user.id,
          currentUserRegistrationStage: user.registrationStage,
          nextUserRegistrationStage: UserRegistrationStage.COMPLETED,
          message: 'User is already PASSWORD_SETUP',
        };
      }

      if (user.registrationStage === UserRegistrationStage.COMPLETED) {
        this.logger.warn(`User with phone '${dto.phone}' already exists`);
        throw new UnauthorizedException(
          'User is already ACCOUNT_SETUP and cannot be registered again',
        );
      }
    }

    const { success } = await this.smsPhoServiceUtils.verifyOTP({
      requestId: dto.requestId,
      code: dto.otp,
    });

    if (success) {
      const newUser = await this.userService.createEntity({
        fcmToken: dto.fcmToken,
        registrationStage: UserRegistrationStage.OTP_VERIFIED,
        phone: dto.phone,
      });
      return {
        userId: newUser.id,
        currentUserRegistrationStage: newUser.registrationStage,
        nextUserRegistrationStage: UserRegistrationStage.PASSWORD_SET,
        message: 'OTP verification succeeded',
      };
    }

    throw new BadRequestException('Invalid OTP');
  }

  async userRegisterPasswordSetup(dto: UserRegisterPasswordSetupDto) {
    const user = await this.userService.findByIdAndStage(
      dto.userId,
      UserRegistrationStage.OTP_VERIFIED,
    );

    if (!user) {
      this.logger.warn(`User with ID '${dto.userId}' not found`);
      throw new UnauthorizedException('User not found');
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    user.password = dto.password;
    user.registrationStage = UserRegistrationStage.PASSWORD_SET;
    await this.userService.saveEntity(user);

    return {
      userId: user.id,
      currentUserRegistrationStage: user.registrationStage,
      nextUserRegistrationStage: UserRegistrationStage.COMPLETED,
      message: 'Password setup succeeded',
    };
  }

  async userRegisterAccountSetup(
    dto: UserRegisterAccountSetupDto,
    file: Express.Multer.File | undefined,
    request: Request,
  ) {
    const user = await this.userService.findByIdAndStage(
      dto.userId,
      UserRegistrationStage.PASSWORD_SET,
    );

    if (!user) {
      this.logger.warn(`User with ID '${dto.userId}' not found`);
      throw new UnauthorizedException('User not found');
    }

    const existingProfileImageUrl = user.profileImageUrl || '';
    const newProfileImageUrl = await this.fileUploadService.resolveUrl({
      file,
      bodyUrl: dto.profileImageUrl,
      existingUrl: existingProfileImageUrl,
      path: 'users/profile',
    });

    user.email = dto.email ?? user.email;
    user.fullName = dto.fullName;
    user.dateOfBirth = dto.dateOfBirth;
    user.gender = dto.gender ?? user.gender;
    user.preferLanguage = dto.preferLanguage ?? user.preferLanguage;
    user.profileImageUrl = newProfileImageUrl;
    user.registrationStage = UserRegistrationStage.COMPLETED;
    user.fcmToken = dto.fcmToken ?? user.fcmToken;
    await this.userService.saveEntity(user);

    await this.fileUploadService.replace(
      newProfileImageUrl,
      existingProfileImageUrl,
    );

    this.eventEmitter.emit(
      ACTIVITY_LOG_EVENT,
      new ActivityLogEvent({
        userId: user.id,
        action: LogAction.REGISTER,
        description: 'User registration completed',
        resourceType: 'Auth',
        resourceId: user.id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      }),
    );

    const loginData = await this.completeUserLogin(user, request);

    return {
      userId: user.id,
      currentUserRegistrationStage: user.registrationStage,
      loginData,
      message: 'Account setup succeeded',
    };
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    _request: Request,
    file?: Express.Multer.File,
  ) {
    const user = await this.userService.findByIdNullable(userId);

    if (!user) {
      this.logger.warn(`User with ID '${userId}' not found`);
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    const dto = updateProfileDto as {
      profileImageUrl?: string;
      password?: string;
    };

    const newProfileImageUrl = await this.fileUploadService.resolveUrl({
      file,
      bodyUrl: dto.profileImageUrl,
      existingUrl: user.profileImageUrl || '',
      path: 'users/profile',
    });

    const updatedUser = await this.userService.preloadEntity({
      id: userId,
      ...updateProfileDto,
      profileImageUrl: newProfileImageUrl,
    });

    if (!updatedUser) {
      throw new BadRequestException(`User with ID '${userId}' not found`);
    }

    if (dto.password) updatedUser.password = dto.password;

    const savedUser = await this.userService.saveEntity(updatedUser);

    await this.fileUploadService.replace(
      newProfileImageUrl,
      user.profileImageUrl || '',
    );

    this.logger.log(`User with ID '${user.id}' profile updated successfully`);
    return savedUser;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    _request: Request,
  ): Promise<void> {
    const user = await this.userService.findByIdNullable(userId);

    if (!user) {
      this.logger.warn(`User with ID '${userId}' not found`);
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      this.logger.warn(
        `User with ID '${userId}' provided incorrect current password`,
      );
      throw new BadRequestException('Incorrect current password');
    }

    user.password = dto.newPassword;
    await this.userService.saveEntity(user);
    await this.tokenService.revokeAllUserTokens(userId);

    this.logger.log(`User with ID '${user.id}' password changed successfully`);
  }

  async deleteProfile(userId: string, _request: Request): Promise<void> {
    const user = await this.userService.findByIdWithRefreshTokens(userId);

    if (!user) {
      this.logger.warn(`User with ID '${userId}' not found`);
      throw new NotFoundException(`User with ID '${userId}' not found`);
    }

    await this.tokenService.revokeAllUserTokens(userId);
    await this.fileUploadService.remove(user.profileImageUrl || '');

    this.logger.log(
      `User with ID '${user.id}' account soft deleted successfully`,
    );
    await this.userService.softDeleteEntity(user);
  }

  async logout(
    refreshTokenString: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.tokenService.revokeToken(refreshTokenString);
    if (user) {
      await this.tokenService.revokeAllUserTokens(user.id);
      this.logger.log(`User with ID '${user.id}' logged out successfully`);
    }
  }
}
