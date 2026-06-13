import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UserModule } from 'src/modules/user/user.module';
import { UserAppController } from './user/user-app.controller';

/**
 * App zone (USER subject) API surface — routes under /api/v1/app/*.
 *
 * Imports domain modules for their services (UserModule) and AuthModule for the
 * SubjectGuard. Controllers here map entities to whitelist response DTOs and are
 * gated by @RequireSubject('USER'). The admin surface lives under /api/v1/admin/*.
 */
@Module({
  imports: [UserModule, AuthModule],
  controllers: [UserAppController],
})
export class AppApiModule {}
