// Public API for AuthModule
export { AuthModule } from './auth.module';

// Guards (applied globally or in module wiring — not imported by controllers)
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { ResourceOwnershipGuard } from './guards/resource-ownership.guard';

// Decorator for ownership check (consumed in guard, not by controllers)
export { CheckOwnership } from './decorators/check-ownership.decorator';

// Entity
export { RefreshToken } from './entities/refresh-token.entity';

// Interfaces — domain-internal only (not needed by controllers)
export { JwtPayload } from './interfaces/user.interface';

// Events
export {
  TWO_FACTOR_CODE_REQUESTED,
  TwoFactorCodeRequestedEvent,
} from './events/two-factor-code-requested.event';
export {
  FORGOT_PASSWORD_CODE_REQUESTED,
  ForgotPasswordCodeRequestedEvent,
} from './events/forgot-password-code-requested.event';
