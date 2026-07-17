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
import {
  AdminService,
  CreateAdminDto,
  FilterAdminDto,
  UpdateAdminDto,
} from 'src/modules/admin/api';
import { AuthenticatedUser, CurrentUser } from 'src/modules/auth';
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
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'create' },
    { module: PermissionModule.ADMIN_LIST, permission: 'create' },
  )
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createAdminDto: CreateAdminDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.create(createAdminDto, file, admin.id, request);
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
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'update' },
    { module: PermissionModule.ADMIN_LIST, permission: 'update' },
  )
  @UseInterceptors(FileInterceptor('profileImage', imageInterceptorOptions))
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() updateAdminDto: UpdateAdminDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.adminService.update(
      id,
      updateAdminDto,
      file,
      admin.id,
      request,
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'delete' },
    { module: PermissionModule.ADMIN_LIST, permission: 'delete' },
  )
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.adminService.remove(id, admin.id, request);
  }
}
