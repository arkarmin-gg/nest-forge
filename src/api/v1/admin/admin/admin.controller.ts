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
import {
  AdminService,
  CreateAdminDto,
  FilterAdminDto,
  UpdateAdminDto,
} from 'src/modules/admin/api';
import { LogAction, LogActivity } from 'src/modules/log/api';
import {
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
} from 'src/modules/role/api';

@Controller({ path: 'admin/admins', version: '1' })
@UseGuards(PermissionsGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  @LogActivity({
    action: LogAction.CREATE,
    description: 'Admin created another admin',
    resourceType: 'Admin',
  })
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'create' },
    { module: PermissionModule.ADMIN_LIST, permission: 'create' },
  )
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createAdminDto: CreateAdminDto,
  ) {
    return this.adminService.create(createAdminDto, file);
  }

  @Get()
  @ResolvePresignedUrls({ path: 'profileImageKey', as: 'profileImageUrl' })
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'read' },
    { module: PermissionModule.ADMIN_LIST, permission: 'read' },
  )
  async findAll(@Query() filters: FilterAdminDto) {
    return this.adminService.findAll(filters);
  }

  @Get(':id')
  @ResolvePresignedUrls({ path: 'profileImageKey', as: 'profileImageUrl' })
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'read' },
    { module: PermissionModule.ADMIN_LIST, permission: 'read' },
  )
  async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminService.findOne(id);
  }

  @Patch(':id')
  @LogActivity({
    action: LogAction.UPDATE,
    description: 'Admin updated another admin',
    resourceType: 'Admin',
  })
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'update' },
    { module: PermissionModule.ADMIN_LIST, permission: 'update' },
  )
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateAdminDto: UpdateAdminDto,
  ) {
    return this.adminService.update(id, updateAdminDto, file);
  }

  @Delete(':id')
  @HttpCode(200)
  @LogActivity({
    action: LogAction.DELETE,
    description: 'Admin deleted another admin',
    resourceType: 'Admin',
  })
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'delete' },
    { module: PermissionModule.ADMIN_LIST, permission: 'delete' },
  )
  async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    await this.adminService.remove(id);
  }
}
