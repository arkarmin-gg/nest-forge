// Public API for AuthModule
export { AuthModule } from './auth.module';

// Services
export { AdminAuthService } from './services/admin-auth.service';
export { PasswordResetService } from './services/password-reset.service';
export { RoleService } from './services/role.service';
export { TokenService } from './services/token.service';
export { TwoFactorService } from './services/two-factor.service';
export { UserAuthService } from './services/user-auth.service';

// Guards
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { PermissionsGuard } from './guards/permissions.guard';
export { ResourceOwnershipGuard } from './guards/resource-ownership.guard';
export { RolesGuard } from './guards/roles.guard';

// Decorators
export { CheckOwnership } from './decorators/check-ownership.decorator';
export { CurrentUser } from './decorators/current-user.decorator';
export { RequirePermissions } from './decorators/permissions.decorator';
export { Public } from './decorators/public.decorator';
export { RequireRoles } from './decorators/roles.decorator';

// Entities
export { ModuleEntity } from './entities/module.entity';
export { Permission } from './entities/permission.entity';
export { RefreshToken } from './entities/refresh-token.entity';
export { Role } from './entities/role.entity';
export { RolePermission } from './entities/role-permission.entity';

// Interfaces
export { AuthenticatedUser, JwtPayload, RequestWithUser } from './interfaces/user.interface';

// Events
export {
  TWO_FACTOR_CODE_REQUESTED,
  TwoFactorCodeRequestedEvent,
} from './events/two-factor-code-requested.event';

// Constants
export { PermissionModule } from './entities/permission.entity';

// DTOs
export { AdminLoginDto } from './dto/admin-login.dto';
export { ChangePasswordDto } from './dto/change-password.dto';
export { CreateRoleDto } from './dto/create-role.dto';
export { DisableTwoFactorDto } from './dto/disable-two-factor.dto';
export { EnableTwoFactorDto } from './dto/enable-two-factor.dto';
export { FilterRoleDto } from './dto/filter-role.dto';
export { ForgotPasswordSendOTPDto } from './dto/forgot-password-send-otp.dto';
export { RefreshTokenDto } from './dto/refresh-token.dto';
export { ResetPasswordDto } from './dto/reset-password.dto';
export { UpdateProfileDto } from './dto/update-profile.dto';
export { UpdateRoleDto } from './dto/update-role.dto';
export { UserAppleLoginDto } from './dto/user-apple-login.dto';
export { UserForgotPasswordSendOTPDto } from './dto/user-forgot-password-send-otp.dto';
export { UserGoogleLoginDto } from './dto/user-google-login.dto';
export { UserLoginDto } from './dto/user-login.dto';
export { UserRegisterAccountSetupDto } from './dto/user-register-account-setup.dto';
export { UserRegisterOTPRequestDto } from './dto/user-register-otp-request.dto';
export { UserRegisterOTPVerifyDto } from './dto/user-register-otp-verify.dto';
export { UserRegisterPasswordSetupDto } from './dto/user-register-password-setup.dto';
export { VerifyPasswordResetOTPCodeDto } from './dto/verify-password-reset-otp-code.dto';
export { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
