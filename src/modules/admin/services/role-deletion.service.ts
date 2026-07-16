import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RoleService } from 'src/modules/role/api';
import { AdminService } from './admin.service';

/**
 * Orchestrates deleting a role under the admin-assignment guard. Lives in the
 * admin module (which already depends on the role module one-way), so it can
 * inject both services without a circular dependency, keeping the controller
 * thin (ARCH-02) and `RoleService.remove()` free of admin concerns.
 */
@Injectable()
export class RoleDeletionService {
  constructor(
    private readonly adminService: AdminService,
    private readonly roleService: RoleService,
  ) {}

  async deleteRole(id: string): Promise<void> {
    const hasAssignedAdmins = await this.adminService.hasAdminsWithRole(id);
    if (hasAssignedAdmins) {
      throw new ConflictException(
        'Cannot delete role that has admins assigned to it',
      );
    }

    const deleted = await this.roleService.remove(id);
    if (!deleted) {
      throw new NotFoundException('Role not found');
    }
  }
}
