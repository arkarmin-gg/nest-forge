import {
  Body,
  Controller,
  Get,
  Patch,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { ResolvePresignedUrls } from 'src/common/decorators';
import { imageInterceptorOptions } from 'src/common/config';
import {
  AuthenticatedUser,
  CurrentUser,
  RequireSubject,
  SubjectGuard,
} from 'src/modules/auth/api';
import { LogAction, LogActivity } from 'src/modules/log/api';
import {
  UpdateUserProfileDto,
  UserAppResponseDto,
  UserService,
} from 'src/modules/user/api';

/**
 * App zone (USER subject) self-service endpoints.
 *
 * Access is restricted to USER subjects via SubjectGuard + @RequireSubject('USER'),
 * and the target is always the authenticated user (@CurrentUser) — there is no
 * :id path param, so a user can only ever read/update their own record.
 *
 * Responses are mapped to UserAppResponseDto (whitelist) so only necessary
 * fields reach the client — never the full entity.
 */
@Controller({ path: 'app/me', version: '1' })
@UseGuards(SubjectGuard)
@RequireSubject('USER')
export class UserAppController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ResolvePresignedUrls({ path: 'profileImageKey', as: 'profileImageUrl' })
  async getProfile(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.userService.findOne(currentUser.id);

    return this.toResponse(user);
  }

  @Patch()
  @LogActivity({
    action: LogAction.UPDATE,
    description: 'User updated their own profile',
    resourceType: 'User',
  })
  @ResolvePresignedUrls({ path: 'profileImageKey', as: 'profileImageUrl' })
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  async updateProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateUserProfileDto: UpdateUserProfileDto,
  ) {
    const user = await this.userService.update(
      currentUser.id,
      updateUserProfileDto,
      file,
    );
    return this.toResponse(user);
  }

  private toResponse(user: unknown): UserAppResponseDto {
    return plainToInstance(UserAppResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
