import { Controller, Get, UseGuards } from '@nestjs/common';
import { RequirePermissions } from 'src/modules/auth/decorators/permissions.decorator';
import { PermissionModule } from 'src/modules/auth/entities/permission.entity';
import { PermissionsGuard } from 'src/modules/auth/guards/permissions.guard';
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
