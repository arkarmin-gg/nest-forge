import { Module } from '@nestjs/common';
import { AdminModule } from 'src/modules/admin';
import { RoleModule } from 'src/modules/role';
import { PermissionsController } from './permissions.controller';
import { RoleController } from './role.controller';

@Module({
  imports: [AdminModule, RoleModule],
  controllers: [RoleController, PermissionsController],
})
export class RoleApiModule {}
