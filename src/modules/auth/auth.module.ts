import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenService } from './services/token.service';
import { UserAuthService } from './services/user-auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { PasswordResetService } from './services/password-reset.service';
import { TwoFactorService } from './services/two-factor.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { OtpModule } from 'src/modules/otp/otp.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ResourceOwnershipGuard } from './guards/resource-ownership.guard';
import { SubjectGuard } from './guards/subject.guard';
import { AuthController } from 'src/api/v1/auth/auth.controller';
import { UserModule } from 'src/modules/user/user.module';
import { AdminModule } from 'src/modules/admin/admin.module';

@Module({
  imports: [
    UserModule,
    AdminModule,
    TypeOrmModule.forFeature([RefreshToken]),
    OtpModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // Default: 15 minutes (900000ms). Override via JWT_EXPIRATION env var.
          expiresIn: configService.get<number>('JWT_EXPIRATION', 900000),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    TokenService,
    UserAuthService,
    AdminAuthService,
    PasswordResetService,
    TwoFactorService,
    JwtStrategy,
    JwtAuthGuard,
    ResourceOwnershipGuard,
    SubjectGuard,
  ],
  controllers: [AuthController],
  exports: [
    TokenService,
    UserAuthService,
    AdminAuthService,
    PasswordResetService,
    TwoFactorService,
    JwtAuthGuard,
    ResourceOwnershipGuard,
    SubjectGuard,
  ],
})
export class AuthModule {}
