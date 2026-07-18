import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../constants/permissions-key.constant';
import { PermissionRequirement } from '../interfaces/permission-requirement.interface';

// Access is granted if the admin's role satisfies ANY of the listed permissions (OR semantics).
// See PermissionsGuard for enforcement logic.
export const RequirePermissions = (...permissions: PermissionRequirement[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
