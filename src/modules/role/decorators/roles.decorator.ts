import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/roles-key.constant';

/** @lintignore Public decorator documented in ARCHITECTURE.md; used by downstream controllers when role checks are needed. */
export const RequireRoles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
