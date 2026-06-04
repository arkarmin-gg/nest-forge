import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ModuleEntity,
  Permission,
  Role,
  RolePermission,
  RoleService,
} from 'src/modules/auth';
import { RoleController } from 'src/api/v1/auth/role.controller';
import { PermissionsController } from 'src/api/v1/auth/permissions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, RolePermission, ModuleEntity]),
  ],
  controllers: [RoleController, PermissionsController],
  providers: [RoleService],
  exports: [RoleService, TypeOrmModule],
})
export class RoleModule {}
