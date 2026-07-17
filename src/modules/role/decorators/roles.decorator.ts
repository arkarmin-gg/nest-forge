import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/roles-key.constant';

export const RequireRoles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
