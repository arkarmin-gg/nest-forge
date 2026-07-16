import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleEntity } from './entities/module.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { RoleService } from './services/role.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, RolePermission, ModuleEntity]),
  ],
  providers: [RoleService, PermissionsGuard, RolesGuard],
  exports: [RoleService, PermissionsGuard, RolesGuard],
})
export class RoleModule {}
