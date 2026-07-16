import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
  RoleService,
} from 'src/modules/role/api';

@Controller({ path: 'admin/permissions', version: '1' })
@UseGuards(PermissionsGuard)
export class PermissionsController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePermissions(
    { module: PermissionModule.ADMIN, permission: 'read' },
    { module: PermissionModule.ADMIN_ROLE_PERMISSIONS, permission: 'read' },
  )
  async findAll() {
    return this.roleService.findAllPermissions();
  }
}
