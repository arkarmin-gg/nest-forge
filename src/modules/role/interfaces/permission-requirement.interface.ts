import { PermissionModule } from '../enums/permission-module.enum';

export interface PermissionRequirement {
  module: PermissionModule;
  permission: 'create' | 'read' | 'update' | 'delete';
}
