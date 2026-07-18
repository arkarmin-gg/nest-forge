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
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { RoleDeletionService } from 'src/modules/admin/public-api';
import { AuthenticatedUser, CurrentUser } from 'src/modules/auth/public-api';
import {
  CreateRoleDto,
  FilterRoleDto,
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
  RoleService,
  UpdateRoleDto,
} from 'src/modules/role/public-api';

@Controller({ path: 'admin/roles', version: '1' })
@UseGuards(PermissionsGuard)
export class RoleController {
  constructor(
    private readonly roleService: RoleService,
    private readonly roleDeletionService: RoleDeletionService,
  ) {}

  @Get()
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'read' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'read' },
  )
  async findAll(@Query() filterDto: FilterRoleDto) {
    return this.roleService.findAll(filterDto);
  }

  @Get(':id')
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'read' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'read' },
  )
  async findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.roleService.findOneOrFail(id);
  }

  @Post()
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'create' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'create' },
  )
  async create(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.roleService.createOrFail(createRoleDto, admin.id, request);
  }

  @Patch(':id')
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'update' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'update' },
  )
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.roleService.updateOrFail(id, updateRoleDto, admin.id, request);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'delete' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'delete' },
  )
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() request: Request,
  ) {
    await this.roleDeletionService.deleteRole(id, admin.id, request);
  }
}
