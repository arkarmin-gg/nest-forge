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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResolvePresignedUrls } from 'src/common/decorators';
import { imageInterceptorOptions } from 'src/common/config';
import { LogAction, LogActivity } from 'src/modules/log/api';
import {
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
} from 'src/modules/role/api';
import {
  CreateUserDto,
  FilterUserDto,
  LoginProvider,
  UpdateUserDto,
  UserService,
} from 'src/modules/user/api';

@Controller({ path: 'admin/users', version: '1' })
@UseGuards(PermissionsGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @LogActivity({
    action: LogAction.CREATE,
    description: 'Admin created a user',
    resourceType: 'User',
  })
  @RequirePermissions(
    { module: PermissionModule.APPLICATION_USER, permission: 'create' },
    { module: PermissionModule.APPLICATION_USER_LIST, permission: 'create' },
  )
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.userService.create(
      { ...createUserDto, loginProvider: LoginProvider.SMS },
      file,
    );
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
  @LogActivity({
    action: LogAction.UPDATE,
    description: 'Admin updated a user',
    resourceType: 'User',
  })
  @RequirePermissions(
    { module: PermissionModule.APPLICATION_USER, permission: 'update' },
    { module: PermissionModule.APPLICATION_USER_LIST, permission: 'update' },
  )
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto, file);
  }

  @Delete(':id')
  @HttpCode(200)
  @LogActivity({
    action: LogAction.DELETE,
    description: 'Admin deleted a user',
    resourceType: 'User',
  })
  @RequirePermissions(
    { module: PermissionModule.APPLICATION_USER, permission: 'delete' },
    { module: PermissionModule.APPLICATION_USER_LIST, permission: 'delete' },
  )
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    await this.userService.remove(id);
  }
}
