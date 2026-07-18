import { ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
// Type-only entity shapes avoid loading module barrels in auth service exports.
// eslint-disable-next-line no-restricted-imports
import type { Admin } from 'src/modules/admin/entities/admin.entity';
// eslint-disable-next-line no-restricted-imports
import type { User } from 'src/modules/user/entities/user.entity';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import type { AuthenticatedUser } from '../interfaces/user.interface';
import { AdminAuthService } from './admin-auth.service';
import { UserAuthService } from './user-auth.service';

/**
 * Dispatches the shared `/auth/me` endpoints to the admin- or user-specific
 * auth service based on the authenticated subject type. Keeps the controller
 * free of business branching (ARCH-02).
 */
@Injectable()
export class AuthProfileService {
  constructor(
    private readonly userAuthService: UserAuthService,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  async updateProfile(
    user: AuthenticatedUser,
    dto: UpdateProfileDto,
    request: Request,
    file?: Express.Multer.File,
  ): Promise<Admin | User> {
    if (user.subjectType === 'ADMIN') {
      return this.adminAuthService.updateProfile(user.id, dto, request, file);
    }
    return this.userAuthService.updateProfile(user.id, dto, request, file);
  }

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
    request: Request,
  ): Promise<void> {
    if (user.subjectType === 'ADMIN') {
      await this.adminAuthService.changePassword(user.id, dto, request);
      return;
    }
    await this.userAuthService.changePassword(user.id, dto, request);
  }

  async deleteProfile(
    user: AuthenticatedUser,
    request: Request,
  ): Promise<void> {
    if (user.subjectType === 'ADMIN') {
      throw new ForbiddenException(
        'Admins cannot delete their own account through this endpoint',
      );
    }
    await this.userAuthService.deleteProfile(user.id, request);
  }
}
