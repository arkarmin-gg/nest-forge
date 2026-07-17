import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ResolvePresignedUrls } from 'src/common/decorators';
import { RequestTimeout } from 'src/common/decorators';
import { imageInterceptorOptions } from 'src/common/config';
import {
  AdminAuthService,
  AdminLoginDto,
  AuthProfileService,
  AuthenticatedUser,
  ChangePasswordDto,
  CurrentUser,
  ForgotPasswordSendOTPDto,
  OAuthLoginPayload,
  PasswordResetService,
  Public,
  RefreshTokenDto,
  ResetPasswordDto,
  TokenService,
  UpdateProfileDto,
  UserAuthService,
  UserForgotPasswordSendOTPDto,
  UserLoginDto,
  UserRegisterOTPRequestDto,
  UserRegisterOTPVerifyDto,
  UserRegisterPasswordSetupDto,
  VerifyPasswordResetOTPCodeDto,
} from 'src/modules/auth/api';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly userAuthService: UserAuthService,
    private readonly adminAuthService: AdminAuthService,
    private readonly authProfileService: AuthProfileService,
    private readonly tokenService: TokenService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  private serializeDate(value: Date | string | null | undefined) {
    if (value instanceof Date) return value.toISOString();
    return value;
  }

  private serializeProfile(user: AuthenticatedUser) {
    return {
      ...user,
      createdAt: this.serializeDate(user.createdAt),
      updatedAt: this.serializeDate(user.updatedAt),
      deletedAt: this.serializeDate(user.deletedAt),
      lastLoginAt: this.serializeDate(user.lastLoginAt),
      lastLogoutAt: this.serializeDate(user.lastLogoutAt),
    };
  }

  @Public()
  @Post('admin/login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() loginDto: AdminLoginDto, @Req() request: Request) {
    return this.adminAuthService.adminLogin(loginDto, request);
  }

  @Public()
  @Post('user/login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async userLogin(@Body() loginDto: UserLoginDto, @Req() request: Request) {
    return this.userAuthService.userLogin(loginDto, request);
  }

  @Public()
  @Post('user/login/oauth')
  @HttpCode(200)
  @RequestTimeout(30_000)
  async userOauthLogin(
    @Body() dto: OAuthLoginPayload,
    @Req() request: Request,
  ) {
    return this.userAuthService.handleOAuthLogin(dto, request);
  }

  @Public()
  @Post('register/otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 900_000 } })
  async userRegisterOTPRequest(@Body() dto: UserRegisterOTPRequestDto) {
    return this.userAuthService.userRegisterOTPRequest(dto);
  }

  @Public()
  @Post('register/otp/verify')
  @HttpCode(200)
  async userRegisterOTPVerify(@Body() dto: UserRegisterOTPVerifyDto) {
    return this.userAuthService.userRegisterOTPVerify(dto);
  }

  @Public()
  @Post('register/password')
  @HttpCode(200)
  async userRegisterPasswordSetup(
    @Body() dto: UserRegisterPasswordSetupDto,
    @Req() request: Request,
  ) {
    return this.userAuthService.userRegisterPasswordSetup(dto, request);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.tokenService.refreshAccessToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(
    @Body() dto: RefreshTokenDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.userAuthService.logout(dto.refreshToken, user, request);
  }

  @Get('me')
  @ResolvePresignedUrls({ path: 'profileImageKey', as: 'profileImageUrl' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.serializeProfile(user);
  }

  @Patch('me')
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  @HttpCode(200)
  @RequestTimeout(30_000)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateProfileDto,
    @Req() request: Request,
  ) {
    return this.authProfileService.updateProfile(user, dto, request, file);
  }

  @Put('me/password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    await this.authProfileService.changePassword(user, dto, request);
  }

  @Delete('me')
  @HttpCode(200)
  async deleteProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.authProfileService.deleteProfile(user, request);
  }

  @Public()
  @Post('admin/forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  async forgotPasswordOTPSend(
    @Body() dto: ForgotPasswordSendOTPDto,
    @Req() request: Request,
  ) {
    return this.passwordResetService.passwordResetOTPSend(dto, request);
  }

  @Public()
  @Post('admin/forgot-password/verify')
  @HttpCode(200)
  async passwordResetOTPVerify(@Body() dto: VerifyPasswordResetOTPCodeDto) {
    return this.passwordResetService.verifyPasswordResetOTPCode(dto);
  }

  @Public()
  @Post('admin/reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    await this.passwordResetService.resetPassword(dto, request);
  }

  @Public()
  @Post('user/forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  async userForgotPasswordOTPSend(
    @Body() dto: UserForgotPasswordSendOTPDto,
    @Req() request: Request,
  ) {
    return this.passwordResetService.userPasswordResetOTPSend(dto, request);
  }

  @Public()
  @Post('user/forgot-password/verify')
  @HttpCode(200)
  async userPasswordResetOTPVerify(@Body() dto: VerifyPasswordResetOTPCodeDto) {
    return this.passwordResetService.userVerifyPasswordResetOTPCode(dto);
  }

  @Public()
  @Post('user/reset-password')
  @HttpCode(200)
  async userResetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ) {
    await this.passwordResetService.userResetPassword(dto, request);
  }
}
