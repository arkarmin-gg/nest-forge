import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { ResolvePresignedUrls } from 'src/common/decorators';
import { imageInterceptorOptions } from 'src/common/config';
import { AuthenticatedUser, CurrentUser } from 'src/modules/auth/public-api';
import {
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
} from 'src/modules/role/public-api';
import {
  CreateUserDto,
  FilterUserDto,
  UpdateUserDto,
  UserService,
} from 'src/modules/user/public-api';

@Controller({ path: 'admin/users', version: '1' })
@UseGuards(PermissionsGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @RequirePermissions(
    { module: PermissionModule.APPLICATION_USER, permission: 'create' },
    { module: PermissionModule.APPLICATION_USER_LIST, permission: 'create' },
  )
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.userService.create(createUserDto, file, admin.id, request);
  }

  @Get()
  @ResolvePresignedUrls({ path: 'profileImageKey', as: 'profileImageUrl' })
  @RequirePermissions(
    { module: PermissionModule.APPLICATION_USER, permission: 'read' },
    { module: PermissionModule.APPLICATION_USER_LIST, permission: 'read' },
  )
  async findAll(@Query() filters: FilterUserDto) {
    return this.userService.findAll(filters);
  }

  @Get(':id')
  @ResolvePresignedUrls({ path: 'profileImageKey', as: 'profileImageUrl' })
  @RequirePermissions(
    { module: PermissionModule.APPLICATION_USER, permission: 'read' },
    { module: PermissionModule.APPLICATION_USER_LIST, permission: 'read' },
  )
  async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(
    { module: PermissionModule.APPLICATION_USER, permission: 'update' },
    { module: PermissionModule.APPLICATION_USER_LIST, permission: 'update' },
  )
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.userService.update(
      id,
      updateUserDto,
      file,
      { id: admin.id, subjectType: 'ADMIN' },
      request,
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(
    { module: PermissionModule.APPLICATION_USER, permission: 'delete' },
    { module: PermissionModule.APPLICATION_USER_LIST, permission: 'delete' },
  )
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.userService.remove(id, admin.id, request);
  }
}
