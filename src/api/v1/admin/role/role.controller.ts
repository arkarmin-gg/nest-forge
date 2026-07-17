import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { RoleDeletionService } from 'src/modules/admin/api';
import { AuthenticatedUser, CurrentUser } from 'src/modules/auth';
import {
  CreateRoleDto,
  FilterRoleDto,
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
  RoleService,
  UpdateRoleDto,
} from 'src/modules/role/api';

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
    const role = await this.roleService.findOne(id);
    if (!role) throw new NotFoundException('Role not found');
    return role;
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
    const role = await this.roleService.create(
      createRoleDto,
      admin.id,
      request,
    );
    if (!role) throw new NotFoundException('Role creation failed');
    return role;
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
    const role = await this.roleService.update(
      id,
      updateRoleDto,
      admin.id,
      request,
    );
    if (!role) throw new NotFoundException('Role not found');
    return role;
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
