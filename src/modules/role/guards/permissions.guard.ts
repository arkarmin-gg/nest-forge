import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../constants/permissions-key.constant';
import { PermissionRequirement } from '../interfaces/permission-requirement.interface';
import { ActionType } from '../enums/action-type.enum';
import type { AuthenticatedUser, RequestWithUser } from 'src/modules/auth/api';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionRequirement[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();

    if (!user || !user.role?.rolePermissions) {
      throw new ForbiddenException('Access denied: No permissions');
    }

    const hasPermission = requiredPermissions.some((requiredPermission) => {
      return this.checkObjectPermission(requiredPermission, user);
    });

    if (!hasPermission) {
      throw new ForbiddenException('Access denied: Insufficient permissions');
    }

    return true;
  }

  private checkObjectPermission(
    requiredPermission: PermissionRequirement,
    user: AuthenticatedUser,
  ): boolean {
    const permissionTypeMap = {
      create: ActionType.CREATE,
      read: ActionType.READ,
      update: ActionType.UPDATE,
      delete: ActionType.DELETE,
    };

    const requiredPermissionType =
      permissionTypeMap[requiredPermission.permission];

    return !!user?.role?.rolePermissions?.some((rolePermission) => {
      const permission = rolePermission.permission;
      const module = permission?.module;

      return (
        module?.code === requiredPermission.module.toString() &&
        permission.action === requiredPermissionType
      );
    });
  }
}
