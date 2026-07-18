import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { FileUploadService } from 'src/common/services';
import { nowUtc } from 'src/common/utils';
import { comparePassword } from 'src/common/utils';
import { buildRequestContext } from 'src/common/utils';
import { SMSPohService } from 'src/common/services';
import {
  LogAction,
  LogQueueService,
  LogStatus,
} from 'src/modules/log/public-api';
// Type-only entity shape avoids loading the user barrel in auth service exports.
// eslint-disable-next-line no-restricted-imports
import type { User } from 'src/modules/user/entities/user.entity';
import { LoginProvider, UserService } from 'src/modules/user/public-api';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { OAuthLoginPayload } from '../dto/oauth-login-payload.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserLoginDto } from '../dto/user-login.dto';
import { UserRegisterOTPRequestDto } from '../dto/user-register-otp-request.dto';
import { UserRegisterOTPVerifyDto } from '../dto/user-register-otp-verify.dto';
import { UserRegisterPasswordSetupDto } from '../dto/user-register-password-setup.dto';
import { AuthenticatedUser, JwtPayload } from '../interfaces/user.interface';
import { RegistrationSessionService } from './registration-session.service';
import { TokenService } from './token.service';

@Injectable()
export class UserAuthService {
  private readonly logger = new Logger(UserAuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly smsPohService: SMSPohService,
    private readonly fileUploadService: FileUploadService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly logQueueService: LogQueueService,
    private readonly registrationSessionService: RegistrationSessionService,
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
    await this.tokenService.revokeAllUserTokens(user.id);
    const refreshToken = await this.tokenService.generateRefreshToken(
      user.id,
      'user',
    );

    this.logger.log(`User with ID '${user.id}' logged in successfully`);

    await this.logQueueService.enqueueActivityLog({
      userId: user.id,
      action: LogAction.LOGIN,
      description: 'User logged in',
      resourceType: 'Auth',
      resourceId: user.id,
      status: LogStatus.SUCCESS,
      ...buildRequestContext(request),
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: this.configService.getOrThrow<number>(
        'jwt.accessTokenTtlSeconds',
      ),
      refreshTokenExpiresAt: this.configService.getOrThrow<number>(
        'jwt.refreshTokenTtlSeconds',
      ),
      user: { id: user.id },
    };
  }

  async userLogin(loginDto: UserLoginDto, request: Request) {
    const user = await this.userService.findByPhoneWithPassword(loginDto.phone);

    if (!user || !user.password) {
      this.logger.warn(
        `Invalid login attempt for phone '${loginDto.phone}' (user not found or no password)`,
      );
      await this.logQueueService.enqueueActivityLog({
        userId: 'unknown',
        action: LogAction.LOGIN,
        description: 'User login failed',
        resourceType: 'Auth',
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw new UnauthorizedException('Invalid phone or password');
    }

    const isPasswordValid = await comparePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      this.logger.warn(
        `Invalid login attempt for phone '${loginDto.phone}' (incorrect password)`,
      );
      await this.logQueueService.enqueueActivityLog({
        userId: user.id,
        action: LogAction.LOGIN,
        description: 'User login failed',
        resourceType: 'Auth',
        resourceId: user.id,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw new UnauthorizedException('Invalid phone or password');
    }

    if (user.isBanned) {
      this.logger.warn(`Banned user with ID '${user.id}' attempted to login`);
      await this.logQueueService.enqueueActivityLog({
        userId: user.id,
        action: LogAction.LOGIN,
        description: 'User login failed — account banned',
        resourceType: 'Auth',
        resourceId: user.id,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw new UnauthorizedException('Your account has been banned');
    }

    user.lastLoginAt = nowUtc();
    await this.userService.saveEntity(user);

    return await this.completeUserLogin(user, request);
  }

  async handleOAuthLogin(payload: OAuthLoginPayload, request: Request) {
    const { provider, providerId, email, fullName, phone } = payload;

    let user: User | null = null;

    if (provider === LoginProvider.GOOGLE) {
      user = await this.userService.findByGoogleId(providerId);
    }

    if (provider === LoginProvider.APPLE) {
      user = await this.userService.findByAppleId(providerId);
    }

    if (!user && email) {
      user = await this.userService.findByEmail(email);
    }

    if (!user) {
      user = await this.userService.createEntity({
        email,
        fullName,
        phone,
        loginProvider: provider,
        googleId: provider === LoginProvider.GOOGLE ? providerId : undefined,
        appleId: provider === LoginProvider.APPLE ? providerId : undefined,
        lastLoginAt: new Date(),
      });

      await this.logQueueService.enqueueActivityLog({
        userId: user.id,
        action: LogAction.LOGIN,
        description: 'User OAuth logged in',
        resourceType: 'Auth',
        resourceId: user.id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });
    } else {
      const updatePayload: Partial<User> = {
        lastLoginAt: new Date(),
      };

      if (provider === LoginProvider.GOOGLE && !user.googleId) {
        updatePayload.googleId = providerId;
      }

      if (provider === LoginProvider.APPLE && !user.appleId) {
        updatePayload.appleId = providerId;
      }

      const preloaded = await this.userService.preloadEntity({
        id: user.id,
        ...updatePayload,
      });
      user = preloaded ? await this.userService.saveEntity(preloaded) : user;
    }

    return await this.completeUserLogin(user, request);
  }

  async userRegisterOTPRequest(dto: UserRegisterOTPRequestDto) {
    const isRegistered = await this.userService.isPhoneRegistered(dto.phone);

    if (isRegistered) {
      throw new ConflictException('Phone number is already registered.');
    }

    const { success, requestId } = await this.smsPohService.sendOTP({
      to: dto.phone,
      message:
        "[{brand}] Dear customer, your OTP code is {code} for register. It'll expire in 30 minutes.",
      ttl: 1800,
      pinLength: 6,
    });

    if (!success) {
      throw new InternalServerErrorException('Failed to send OTP Verification');
    }

    await this.registrationSessionService.create(dto.phone, {
      fullName: dto.fullName,
      requestId,
    });

    return { requestId, message: 'OTP verification code sent to your phone' };
  }

  async userRegisterOTPVerify(dto: UserRegisterOTPVerifyDto) {
    const isRegistered = await this.userService.isPhoneRegistered(dto.phone);

    if (isRegistered) {
      throw new ConflictException('Phone number is already registered.');
    }

    const session = await this.registrationSessionService.get(dto.phone);

    this.registrationSessionService.validateRequestId(session, dto.requestId);

    if (session.otpVerified) {
      return {
        message: 'OTP verification already completed',
      };
    }

    await this.smsPohService.verifyOTP({
      requestId: dto.requestId,
      code: dto.otp,
    });

    await this.registrationSessionService.markVerified(dto.phone);

    return {
      message: 'OTP verification completed',
    };
  }

  async userRegisterPasswordSetup(
    dto: UserRegisterPasswordSetupDto,
    request: Request,
  ) {
    if (dto.confirmPassword !== dto.password) {
      throw new BadRequestException('Passwords do not match');
    }

    const isRegistered = await this.userService.isPhoneRegistered(dto.phone);

    if (isRegistered) {
      throw new ConflictException('Phone number is already registered.');
    }

    const session = await this.registrationSessionService.get(dto.phone);

    this.registrationSessionService.requireOtpVerified(session);

    const user = await this.userService.createEntity({
      phone: dto.phone,
      fullName: session.fullName,
      password: dto.password,
      loginProvider: LoginProvider.SMS,
      lastLoginAt: nowUtc(),
    });

    await this.registrationSessionService.delete(dto.phone);

    const loginData = await this.completeUserLogin(user, request);

    return {
      ...loginData,
      message: 'User registered successfully',
    };
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    request: Request,
    file?: Express.Multer.File,
  ) {
    try {
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
        existingUrl: user.profileImageKey || '',
        path: 'users/profile',
      });

      const updatedUser = await this.userService.preloadEntity({
        id: userId,
        ...updateProfileDto,
        profileImageKey: newProfileImageUrl,
      });

      if (!updatedUser) {
        throw new BadRequestException(`User with ID '${userId}' not found`);
      }

      if (dto.password) updatedUser.password = dto.password;

      const savedUser = await this.userService.saveEntity(updatedUser);

      await this.fileUploadService.replace(
        newProfileImageUrl,
        user.profileImageKey || '',
      );

      this.logger.log(`User with ID '${user.id}' profile updated successfully`);

      await this.logQueueService.enqueueActivityLog({
        userId,
        action: LogAction.UPDATE_PROFILE,
        description: 'Profile updated',
        resourceType: 'Auth',
        resourceId: userId,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });

      return savedUser;
    } catch (error) {
      await this.logQueueService.enqueueActivityLog({
        userId,
        action: LogAction.UPDATE_PROFILE,
        description: 'Profile update failed',
        resourceType: 'Auth',
        resourceId: userId,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    request: Request,
  ): Promise<void> {
    try {
      const user = await this.userService.findByIdWithPassword(userId);

      if (!user) {
        this.logger.warn(`User with ID '${userId}' not found`);
        throw new NotFoundException(`User with ID '${userId}' not found`);
      }

      const isCurrentPasswordValid = await comparePassword(
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

      this.logger.log(
        `User with ID '${user.id}' password changed successfully`,
      );

      await this.logQueueService.enqueueActivityLog({
        userId,
        action: LogAction.CHANGE_PASSWORD,
        description: 'Password changed',
        resourceType: 'Auth',
        resourceId: userId,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });
    } catch (error) {
      await this.logQueueService.enqueueActivityLog({
        userId,
        action: LogAction.CHANGE_PASSWORD,
        description: 'Password change failed',
        resourceType: 'Auth',
        resourceId: userId,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  async deleteProfile(userId: string, request: Request): Promise<void> {
    try {
      const user = await this.userService.findByIdWithRefreshTokens(userId);

      if (!user) {
        this.logger.warn(`User with ID '${userId}' not found`);
        throw new NotFoundException(`User with ID '${userId}' not found`);
      }

      await this.tokenService.revokeAllUserTokens(userId);
      await this.fileUploadService.remove(user.profileImageKey || '');

      this.logger.log(
        `User with ID '${user.id}' account soft deleted successfully`,
      );
      await this.userService.softDeleteEntity(user);

      await this.logQueueService.enqueueActivityLog({
        userId,
        action: LogAction.DELETE_ACCOUNT,
        description: 'Account deleted',
        resourceType: 'Auth',
        resourceId: userId,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });
    } catch (error) {
      await this.logQueueService.enqueueActivityLog({
        userId,
        action: LogAction.DELETE_ACCOUNT,
        description: 'Account deletion failed',
        resourceType: 'Auth',
        resourceId: userId,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }

  async logout(
    refreshTokenString: string,
    user: AuthenticatedUser,
    request: Request,
  ): Promise<void> {
    await this.tokenService.revokeToken(refreshTokenString);
    if (user) {
      await this.tokenService.revokeAllUserTokens(user.id);
      this.logger.log(`User with ID '${user.id}' logged out successfully`);

      if (user.subjectType === 'ADMIN') {
        await this.logQueueService.enqueueAuditLog({
          adminId: user.id,
          action: LogAction.LOGOUT,
          description: 'Logged out',
          entityName: 'Auth',
          entityId: user.id,
          status: LogStatus.SUCCESS,
          ...buildRequestContext(request),
        });
      } else {
        await this.logQueueService.enqueueActivityLog({
          userId: user.id,
          action: LogAction.LOGOUT,
          description: 'Logged out',
          resourceType: 'Auth',
          resourceId: user.id,
          status: LogStatus.SUCCESS,
          ...buildRequestContext(request),
        });
      }
    }
  }
}
