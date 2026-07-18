import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { ResolvePresignedUrls } from 'src/common/decorators';
import { imageInterceptorOptions } from 'src/common/config';
import {
  AuthenticatedUser,
  CurrentUser,
  RequireSubject,
  SubjectGuard,
  SubjectType,
} from 'src/modules/auth/public-api';
import {
  UpdateUserProfileDto,
  UserAppResponseDto,
  UserService,
} from 'src/modules/user/public-api';

/**
 * App zone (USER subject) self-service endpoints.
 *
 * Access is restricted to USER subjects via SubjectGuard + @RequireSubject(SubjectType.USER),
 * and the target is always the authenticated user (@CurrentUser) — there is no
 * :id path param, so a user can only ever read/update their own record.
 *
 * Responses are mapped to UserAppResponseDto (whitelist) so only necessary
 * fields reach the client — never the full entity.
 */
@Controller({ path: 'app/me', version: '1' })
@UseGuards(SubjectGuard)
@RequireSubject(SubjectType.USER)
export class UserAppController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ResolvePresignedUrls({ path: 'profileImageKey', as: 'profileImageUrl' })
  async getProfile(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.userService.findOne(currentUser.id);

    return this.toResponse(user);
  }

  @Patch()
  @ResolvePresignedUrls({ path: 'profileImageKey', as: 'profileImageUrl' })
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  async updateProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateUserProfileDto: UpdateUserProfileDto,
    @Req() request: Request,
  ) {
    const user = await this.userService.updateOwnProfile(
      currentUser.id,
      updateUserProfileDto,
      file,
      request,
    );
    return this.toResponse(user);
  }

  private toResponse(user: unknown): UserAppResponseDto {
    return plainToInstance(UserAppResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
