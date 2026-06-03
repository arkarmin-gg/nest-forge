import { Controller, Get, UseGuards } from '@nestjs/common';
import { RoleService } from '../services/role.service';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { PermissionModule } from '../entities/permission.entity';

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
