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
import { ResolvePresignedUrls } from 'src/common/decorators/presigned-urls.decorator';
import { profileImageInterceptorOptions } from 'src/common/utils/file-interceptor.util';
import { RequirePermissions } from 'src/v1/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/v1/auth/entities/permission.entity';
import { PermissionsGuard } from 'src/v1/auth/guards/permissions.guard';
import { LogActivity } from 'src/v1/log/decorators/log-activity.decorator';
import { LogAction } from 'src/v1/log/constants/log-action.enum';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { FilterAdminDto } from '../dto/filter-admin.dto';
import { UpdateAdminDto } from '../dto/update-admin.dto';
import { AdminService } from '../services/admin.service';

@Controller({ path: 'admins', version: '1' })
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
  @UseInterceptors(
    FileInterceptor('profileImage', profileImageInterceptorOptions),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createAdminDto: CreateAdminDto,
  ) {
    return this.adminService.create(createAdminDto, file);
  }

  @Get()
  @ResolvePresignedUrls('profileImageUrl')
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'read' },
    { module: PermissionModule.ADMIN_LIST, permission: 'read' },
  )
  async findAll(@Query() filters: FilterAdminDto) {
    return this.adminService.findAll(filters);
  }

  @Get(':id')
  @ResolvePresignedUrls('profileImageUrl')
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
  @UseInterceptors(
    FileInterceptor('profileImage', profileImageInterceptorOptions),
  )
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
