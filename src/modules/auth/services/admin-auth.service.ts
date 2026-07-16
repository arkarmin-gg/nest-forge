import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { FileUploadService } from 'src/common/services';
import { comparePassword } from 'src/common/utils';
import { buildRequestContext } from 'src/common/utils';
import { Admin } from 'src/modules/admin';
import { AdminService } from 'src/modules/admin/api';
import { AUDIT_LOG_EVENT, AuditLogEvent, LogStatus } from 'src/modules/log';
import { LogAction } from 'src/modules/log/api';
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
    private readonly eventEmitter: EventEmitter2,
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

    this.eventEmitter.emit(
      AUDIT_LOG_EVENT,
      new AuditLogEvent({
        adminId: admin.id,
        action: LogAction.LOGIN,
        description: 'Admin logged in',
        entityName: 'Admin',
        entityId: admin.id,
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
      this.eventEmitter.emit(
        AUDIT_LOG_EVENT,
        new AuditLogEvent({
          adminId: null,
          action: LogAction.LOGIN,
          description: 'Admin login failed',
          entityName: 'Admin',
          status: LogStatus.FAILURE,
          ...buildRequestContext(request),
        }),
      );
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
    _request: Request,
    file?: Express.Multer.File,
  ): Promise<Admin> {
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

    await this.fileUploadService.replace(
      newProfileImageUrl,
      admin.profileImageKey || '',
    );

    this.logger.log(`Admin with ID '${admin.id}' profile updated successfully`);
    return savedAdmin;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    _request: Request,
  ): Promise<void> {
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
  }
}
