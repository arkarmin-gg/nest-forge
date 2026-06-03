import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenService } from './services/token.service';
import { UserAuthService } from './services/user-auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { PasswordResetService } from './services/password-reset.service';
import { RoleService } from './services/role.service';
import { TwoFactorService } from './services/two-factor.service';
import { RoleController } from './controllers/role.controller';
import { PermissionsController } from './controllers/permissions.controller';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { ModuleEntity } from './entities/module.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { OtpModule } from 'src/v1/otp/otp.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { ResourceOwnershipGuard } from './guards/resource-ownership.guard';
import { User } from 'src/v1/user/entities/user.entity';
import { Admin } from 'src/v1/admin/entities/admin.entity';
import { AuthController } from './controllers/auth.controller';
import { ActivityLogModule } from 'src/v1/log/activity-log.module';
import { AuthSeeder } from './seeders/auth.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Admin,
      Role,
      Permission,
      RolePermission,
      ModuleEntity,
      RefreshToken,
    ]),
    OtpModule,
    ActivityLogModule,
    PassportModule,
    // NotificationModule removed — TwoFactorService now emits domain events
    // dispatched by TwoFactorCodeListener in NotificationModule
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
    RoleService,
    TwoFactorService,
    JwtStrategy,
    JwtAuthGuard,
    PermissionsGuard,
    RolesGuard,
    ResourceOwnershipGuard,
    AuthSeeder,
  ],
  controllers: [AuthController, RoleController, PermissionsController],
  exports: [
    TokenService,
    UserAuthService,
    AdminAuthService,
    PasswordResetService,
    RoleService,
    TwoFactorService,
    JwtAuthGuard,
    PermissionsGuard,
    RolesGuard,
    ResourceOwnershipGuard,
  ],
})
export class AuthModule {}
