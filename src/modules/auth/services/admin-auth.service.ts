import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Request } from 'express';
import { FileUploadService } from 'src/common/services/file-upload.service';
import { Admin, AdminService } from 'src/modules/admin';
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
    private adminService: AdminService,
    private tokenService: TokenService,
    private twoFactorService: TwoFactorService,
    private fileUploadService: FileUploadService,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  async validateAdminById(id: string): Promise<Admin | null> {
    return this.adminService.findByIdWithRoleRelations(id);
  }

  private async validateAdmin(
    email: string,
    plainPassword: string,
  ): Promise<Admin> {
    const admin = await this.adminService.findByEmailWithRoleRelations(email);

    if (!admin) throw new UnauthorizedException('Invalid credentials');

    if (!(await bcrypt.compare(plainPassword, admin.password))) {
      throw new UnauthorizedException('Invalid password');
    }

    return admin;
  }

  private async completeAdminLogin(admin: Admin, _request: Request) {
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

    const fullAdmin = await this.adminService.findByIdWithRoleRelations(
      admin.id,
    );

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

    const admin = await this.adminService.findByIdWithRoleRelations(userId);

    if (!admin) {
      throw new UnauthorizedException(`Admin with ID '${userId}' not found`);
    }

    return this.completeAdminLogin(admin, request);
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    _request: Request,
    file?: Express.Multer.File,
  ) {
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
      existingUrl: admin.profileImageUrl || '',
      path: 'admins/profile',
    });

    const updatedAdmin = await this.adminService.preloadEntity({
      id: userId,
      fullName: dto.fullName ?? admin.fullName,
      email: dto.email ?? admin.email,
      profileImageUrl: newProfileImageUrl,
    });

    if (!updatedAdmin) {
      throw new NotFoundException(`Admin with ID '${userId}' not found`);
    }

    if (dto.password) updatedAdmin.password = dto.password;

    const savedAdmin = await this.adminService.saveEntity(updatedAdmin);

    await this.fileUploadService.replace(
      newProfileImageUrl,
      admin.profileImageUrl || '',
    );

    this.logger.log(`Admin with ID '${admin.id}' profile updated successfully`);
    return savedAdmin;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    _request: Request,
  ): Promise<void> {
    const admin = await this.adminService.findByIdNullable(userId);

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
    await this.adminService.saveEntity(admin);
    await this.tokenService.revokeAllAdminTokens(userId);

    this.logger.log(
      `Admin with ID '${admin.id}' password changed successfully`,
    );
  }
}
