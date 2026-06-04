import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { ResolvePresignedUrls } from 'src/common/decorators/presigned-urls.decorator';
import { RequestTimeout } from 'src/common/decorators/request-timeout.decorator';
import { profileImageInterceptorOptions } from 'src/common/utils/file-interceptor.util';
import {
  AdminAuthService,
  AdminLoginDto,
  AuthenticatedUser,
  ChangePasswordDto,
  CurrentUser,
  DisableTwoFactorDto,
  EnableTwoFactorDto,
  ForgotPasswordSendOTPDto,
  PasswordResetService,
  Public,
  RefreshTokenDto,
  ResetPasswordDto,
  TokenService,
  TwoFactorService,
  UpdateProfileDto,
  UserAppleLoginDto,
  UserAuthService,
  UserForgotPasswordSendOTPDto,
  UserGoogleLoginDto,
  UserLoginDto,
  UserRegisterAccountSetupDto,
  UserRegisterOTPRequestDto,
  UserRegisterOTPVerifyDto,
  UserRegisterPasswordSetupDto,
  VerifyPasswordResetOTPCodeDto,
  VerifyTwoFactorDto,
} from 'src/modules/auth';
import { LogAction, LogActivity } from 'src/modules/log';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private userAuthService: UserAuthService,
    private adminAuthService: AdminAuthService,
    private tokenService: TokenService,
    private passwordResetService: PasswordResetService,
    private twoFactorService: TwoFactorService,
  ) {}

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
  @Post('user/login/google')
  @HttpCode(200)
  @RequestTimeout(30_000)
  async userGoogleLogin(
    @Body() dto: UserGoogleLoginDto,
    @Req() request: Request,
  ) {
    return this.userAuthService.userGoogleLogin(dto, request);
  }

  @Public()
  @Post('user/login/apple')
  @HttpCode(200)
  @RequestTimeout(30_000)
  async userAppleLogin(
    @Body() dto: UserAppleLoginDto,
    @Req() request: Request,
  ) {
    return this.userAuthService.userAppleLogin(dto, request);
  }

  @Public()
  @Post('register/otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
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
  async userRegisterPasswordSetup(@Body() dto: UserRegisterPasswordSetupDto) {
    return this.userAuthService.userRegisterPasswordSetup(dto);
  }

  @Public()
  @Post('register')
  @UseInterceptors(
    FileInterceptor('profileImage', profileImageInterceptorOptions),
  )
  @HttpCode(200)
  @RequestTimeout(30_000)
  async userRegisterAccountSetup(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UserRegisterAccountSetupDto,
    @Req() request: Request,
  ) {
    return this.userAuthService.userRegisterAccountSetup(dto, file, request);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.tokenService.refreshAccessToken(dto.refreshToken);
  }

  @Post('logout')
  @LogActivity({
    action: LogAction.LOGOUT,
    description: 'User logged out',
    resourceType: 'Auth',
    getResourceId: (_, req) =>
      (req as unknown as { user?: { id?: string } }).user?.id,
  })
  @HttpCode(200)
  async logout(
    @Body() dto: RefreshTokenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.userAuthService.logout(dto.refreshToken, user);
  }

  @Get('me')
  @ResolvePresignedUrls('profileImageUrl')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Patch('me')
  @UseInterceptors(
    FileInterceptor('profileImage', profileImageInterceptorOptions),
  )
  @HttpCode(200)
  @RequestTimeout(30_000)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateProfileDto,
    @Req() request: Request,
  ) {
    if (user.subjectType === 'ADMIN') {
      return this.adminAuthService.updateProfile(user.id, dto, request, file);
    }
    return this.userAuthService.updateProfile(user.id, dto, request, file);
  }

  @Put('me/password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    if (user.subjectType === 'ADMIN') {
      await this.adminAuthService.changePassword(user.id, dto, request);
    } else {
      await this.userAuthService.changePassword(user.id, dto, request);
    }
  }

  @Delete('me')
  @HttpCode(200)
  async deleteProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (user.subjectType === 'ADMIN') {
      throw new ForbiddenException(
        'Admins cannot delete their own account through this endpoint',
      );
    }
    await this.userAuthService.deleteProfile(user.id, request);
  }

  @Public()
  @Post('2fa/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
    @Req() request: Request,
  ) {
    return this.adminAuthService.verifyTwoFactorAndLogin(
      dto.userId,
      dto.code,
      request,
    );
  }

  @Post('2fa/enable')
  @HttpCode(200)
  async enableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnableTwoFactorDto,
  ) {
    await this.twoFactorService.enableTwoFactor(user.id, dto.email);
  }

  @Public()
  @Post('2fa/enable/confirm')
  @HttpCode(200)
  async enableTwoFactorVerify(@Body() dto: VerifyTwoFactorDto) {
    return this.twoFactorService.verifyTwoFactor(dto.userId, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(200)
  async disableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisableTwoFactorDto,
  ) {
    await this.twoFactorService.disableTwoFactor(user.id, dto.password);
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
