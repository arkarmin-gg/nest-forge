import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  PermissionModule,
  PermissionsGuard,
  RequirePermissions,
} from 'src/modules/auth';
import { RoleService } from 'src/modules/role';

@Controller({ path: 'permissions', version: '1' })
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
