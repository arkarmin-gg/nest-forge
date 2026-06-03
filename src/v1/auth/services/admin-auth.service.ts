import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Request } from 'express';
import { FileUploadService } from 'src/common/services/file-upload.service';
import { nowUtc } from 'src/common/utils/date-time.util';
import { buildRequestContext } from 'src/common/utils/request-context.util';
import { Admin } from 'src/v1/admin/entities/admin.entity';
import { LogAction } from 'src/v1/log/constants/log-action.enum';
import { CreateAuditLogData } from 'src/v1/log/interfaces/create-audit-log.interface';
import { AuditLogService } from 'src/v1/log/services/audit-log.service';
import { Repository } from 'typeorm';
import { AdminLoginDto } from '../dto/admin-login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { JwtPayload } from '../interfaces/user.interface';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    private tokenService: TokenService,
    private twoFactorService: TwoFactorService,
    private auditLogService: AuditLogService,
    private fileUploadService: FileUploadService,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  async validateAdminById(id: string): Promise<Admin | null> {
    return this.adminRepository.findOne({
      where: { id },
      relations: [
        'role',
        'role.rolePermissions',
        'role.rolePermissions.permission',
        'role.rolePermissions.permission.module',
      ],
    });
  }

  private async logAudit(
    request: Request,
    adminId: string,
    action: LogAction,
    description: string,
    extra?: Partial<CreateAuditLogData>,
  ): Promise<void> {
    await this.auditLogService
      .create({
        adminId,
        action,
        description,
        entityName: extra?.entityName ?? 'admin',
        entityId: extra?.entityId ?? adminId,
        ...buildRequestContext(request),
        ...extra,
      })
      .catch((err: unknown) =>
        this.logger.error('Failed to write audit log:', err),
      );
  }

  private async validateAdmin(
    email: string,
    plainPassword: string,
  ): Promise<Admin> {
    const admin = await this.adminRepository.findOne({
      where: { email },
      relations: [
        'role',
        'role.rolePermissions',
        'role.rolePermissions.permission',
        'role.rolePermissions.permission.module',
      ],
    });

    if (!admin) throw new UnauthorizedException('Invalid credentials');

    if (!(await bcrypt.compare(plainPassword, admin.password))) {
      throw new UnauthorizedException('Invalid password');
    }

    return admin;
  }

  private async completeAdminLogin(admin: Admin, request: Request) {
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

    const previousLastLoginAt = admin.lastLoginAt;
    const lastLoginAt = nowUtc();
    await this.adminRepository.update(admin.id, { lastLoginAt });

    await this.logAudit(
      request,
      admin.id,
      LogAction.LOGIN,
      'Admin logged in successfully',
      {
        oldValue: { lastLoginAt: previousLastLoginAt },
        newValue: { lastLoginAt },
      },
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

  async adminLogin(loginDto: AdminLoginDto, request: Request) {
    const admin = await this.validateAdmin(loginDto.email, loginDto.password);

    const is2FAEnabled = await this.twoFactorService.isTwoFactorEnabled(
      admin.id,
    );

    if (is2FAEnabled) {
      await this.twoFactorService.sendVerificationCode(admin.id);
      return {
        requiresTwoFactor: true,
        userId: admin.id,
        message: 'Two-factor authentication code sent to your email',
      };
    }

    const fullAdmin = await this.adminRepository.findOne({
      where: { id: admin.id },
      relations: [
        'role',
        'role.rolePermissions',
        'role.rolePermissions.permission',
        'role.rolePermissions.permission.module',
      ],
    });

    if (!fullAdmin) {
      throw new UnauthorizedException(`Admin with ID '${admin.id}' not found`);
    }

    return this.completeAdminLogin(fullAdmin, request);
  }

  async verifyTwoFactorAndLogin(
    userId: string,
    code: string,
    request: Request,
  ) {
    const isValidCode = await this.twoFactorService.validateLoginCode(
      userId,
      code,
    );

    if (!isValidCode) {
      this.logger.warn(
        `Invalid or expired verification code for user with ID '${userId}'`,
      );
      throw new UnauthorizedException(
        `Invalid or expired verification code for user with ID '${userId}'`,
      );
    }

    const admin = await this.adminRepository.findOne({
      where: { id: userId },
      relations: [
        'role',
        'role.rolePermissions',
        'role.rolePermissions.permission',
        'role.rolePermissions.permission.module',
      ],
    });

    if (!admin) {
      throw new UnauthorizedException(`Admin with ID '${userId}' not found`);
    }

    return this.completeAdminLogin(admin, request);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    request: Request,
    file?: Express.Multer.File,
  ) {
    const admin = await this.adminRepository.findOne({ where: { id: userId } });

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

    const newProfileImageUrl =
      await this.fileUploadService.resolveProfileImageUrl({
        file,
        bodyUrl: dto.profileImageUrl,
        existingUrl: admin.profileImageUrl || '',
        s3Path: 'admins/profile',
      });

    const updatedAdmin = await this.adminRepository.preload({
      id: userId,
      fullName: dto.fullName ?? admin.fullName,
      email: dto.email ?? admin.email,
      profileImageUrl: newProfileImageUrl,
    });

    if (!updatedAdmin) {
      throw new NotFoundException(`Admin with ID '${userId}' not found`);
    }

    if (dto.password) updatedAdmin.password = dto.password;

    const savedAdmin = await this.adminRepository.save(updatedAdmin);

    await this.fileUploadService.replaceProfileImage(
      newProfileImageUrl,
      admin.profileImageUrl || '',
    );

    await this.logAudit(
      request,
      admin.id,
      LogAction.UPDATE_PROFILE,
      'Admin profile updated successfully',
    );

    this.logger.log(`Admin with ID '${admin.id}' profile updated successfully`);
    return savedAdmin;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    request: Request,
  ): Promise<void> {
    const admin = await this.adminRepository.findOne({ where: { id: userId } });

    if (!admin) {
      this.logger.warn(`Admin with ID '${userId}' not found`);
      throw new NotFoundException(`Admin with ID '${userId}' not found`);
    }

    const isCurrentPasswordValid = await bcrypt.compare(
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
    await this.adminRepository.save(admin);
    await this.tokenService.revokeAllAdminTokens(userId);

    this.logger.log(
      `Admin with ID '${admin.id}' password changed successfully`,
    );
    await this.logAudit(
      request,
      admin.id,
      LogAction.CHANGE_PASSWORD,
      'Admin password changed successfully',
    );
  }
}
