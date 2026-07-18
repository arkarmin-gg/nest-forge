import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { FileUploadService } from 'src/common/services';
import { comparePassword } from 'src/common/utils';
import { buildRequestContext } from 'src/common/utils';
// Type-only entity shape avoids loading the admin barrel in auth service exports.
// eslint-disable-next-line no-restricted-imports
import type { Admin } from 'src/modules/admin/entities/admin.entity';
import { AdminService } from 'src/modules/admin/public-api';
import {
  diffAuditValues,
  LogAction,
  LogQueueService,
  LogStatus,
} from 'src/modules/log/public-api';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { AdminLoginResult } from '../interfaces/admin-login-result.interface';
import { JwtPayload } from '../interfaces/user.interface';
import { TokenService } from './token.service';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly tokenService: TokenService,
    private readonly fileUploadService: FileUploadService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly logQueueService: LogQueueService,
  ) {}

  async validateAdminById(id: string): Promise<Admin | null> {
    return this.adminService.findByIdWithRoleRelations(id);
  }

  private async validateAdmin(
    email: string,
    plainPassword: string,
  ): Promise<Admin> {
    const admin = await this.adminService.findByEmailWithPassword(email);

    if (!admin) throw new UnauthorizedException('Invalid credentials');

    if (!(await comparePassword(plainPassword, admin.password))) {
      throw new UnauthorizedException('Invalid password');
    }

    return admin;
  }

  private async completeAdminLogin(
    admin: Admin,
    request: Request,
  ): Promise<AdminLoginResult> {
    const payload: JwtPayload = {
      sub: admin.id,
      subjectType: 'ADMIN',
      adminId: admin.id,
      roleId: admin.role.id,
    };

    const accessToken = this.jwtService.sign(payload);
    await this.tokenService.revokeAllAdminTokens(admin.id);
    const refreshToken = await this.tokenService.generateRefreshToken(
      admin.id,
      'admin',
    );

    await this.adminService.updateFields(admin.id, {
      lastLoginAt: new Date(),
    });

    this.logger.log(`Admin with ID '${admin.id}' logged in successfully`);

    await this.logQueueService.enqueueAuditLog({
      adminId: admin.id,
      action: LogAction.LOGIN,
      description: 'Admin logged in',
      entityName: 'Admin',
      entityId: admin.id,
      status: LogStatus.SUCCESS,
      ...buildRequestContext(request),
    });

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
      user: { id: admin.id },
    };
  }

  async adminLogin(
    loginDto: AdminLoginDto,
    request: Request,
  ): Promise<AdminLoginResult> {
    let admin: Admin;
    try {
      admin = await this.validateAdmin(loginDto.email, loginDto.password);
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId: null,
        action: LogAction.LOGIN,
        description: 'Admin login failed',
        entityName: 'Admin',
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }

    const fullAdmin = await this.adminService.findByIdWithRoleRelations(
      admin.id,
    );

    if (!fullAdmin) {
      throw new UnauthorizedException(`Admin with ID '${admin.id}' not found`);
    }

    return this.completeAdminLogin(fullAdmin, request);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    request: Request,
    file?: Express.Multer.File,
  ): Promise<Admin> {
    try {
      const admin = await this.adminService.findByIdNullable(userId);

      if (!admin) {
        this.logger.warn(`Admin with ID '${userId}' not found`);
        throw new NotFoundException(`Admin with ID '${userId}' not found`);
      }

      const dto = updateProfileDto as {
        profileImageUrl?: string;
        password?: string;
        fullName?: string;
        email?: string;
      };

      const newProfileImageUrl = await this.fileUploadService.resolveUrl({
        file,
        bodyUrl: dto.profileImageUrl,
        existingUrl: admin.profileImageKey || '',
        path: 'admins/profile',
      });

      const updatedAdmin = await this.adminService.preloadEntity({
        id: userId,
        fullName: dto.fullName ?? admin.fullName,
        email: dto.email ?? admin.email,
        profileImageKey: newProfileImageUrl,
      });

      if (!updatedAdmin) {
        throw new NotFoundException(`Admin with ID '${userId}' not found`);
      }

      if (dto.password) updatedAdmin.password = dto.password;

      const savedAdmin = await this.adminService.saveEntity(updatedAdmin);

      const { oldValue, newValue } = diffAuditValues(admin, savedAdmin, [
        'fullName',
        'email',
        'profileImageKey',
        'password',
      ]);

      await this.fileUploadService.replace(
        newProfileImageUrl,
        admin.profileImageKey || '',
      );

      this.logger.log(
        `Admin with ID '${admin.id}' profile updated successfully`,
      );

      await this.logQueueService.enqueueAuditLog({
        adminId: userId,
        action: LogAction.UPDATE_PROFILE,
        description: 'Profile updated',
        entityName: 'Auth',
        entityId: userId,
        oldValue,
        newValue,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });

      return savedAdmin;
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId: userId,
        action: LogAction.UPDATE_PROFILE,
        description: 'Profile update failed',
        entityName: 'Auth',
        entityId: userId,
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
      const admin = await this.adminService.findByIdWithPassword(userId);

      if (!admin) {
        this.logger.warn(`Admin with ID '${userId}' not found`);
        throw new NotFoundException(`Admin with ID '${userId}' not found`);
      }

      const isCurrentPasswordValid = await comparePassword(
        dto.currentPassword,
        admin.password,
      );

      if (!isCurrentPasswordValid) {
        this.logger.warn(
          `Admin with ID '${userId}' provided incorrect current password`,
        );
        throw new BadRequestException('Incorrect current password');
      }

      admin.password = dto.newPassword;
      await this.adminService.saveEntity(admin);
      await this.tokenService.revokeAllAdminTokens(userId);

      this.logger.log(
        `Admin with ID '${admin.id}' password changed successfully`,
      );

      await this.logQueueService.enqueueAuditLog({
        adminId: userId,
        action: LogAction.CHANGE_PASSWORD,
        description: 'Password changed',
        entityName: 'Auth',
        entityId: userId,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId: userId,
        action: LogAction.CHANGE_PASSWORD,
        description: 'Password change failed',
        entityName: 'Auth',
        entityId: userId,
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }
}
