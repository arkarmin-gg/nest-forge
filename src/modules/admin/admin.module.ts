import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from './entities/admin.entity';
import { AdminService } from './services/admin.service';
import { RoleDeletionService } from './services/role-deletion.service';
import { AdminController } from 'src/api/v1/admin/admin/admin.controller';
import { ActivityLogModule } from 'src/modules/log';
import { RoleModule } from 'src/modules/role/role.module';

@Module({
  imports: [TypeOrmModule.forFeature([Admin]), RoleModule, ActivityLogModule],
  providers: [AdminService, RoleDeletionService],
  controllers: [AdminController],
  exports: [AdminService, RoleDeletionService, TypeOrmModule],
})
export class AdminModule {}
