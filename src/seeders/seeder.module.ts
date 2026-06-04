import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envValidationSchema } from '../common/config/env.validation';
import dataSource from '../data-source';
import { Admin } from 'src/modules/admin/entities/admin.entity';
import { ModuleEntity } from 'src/modules/auth/entities/module.entity';
import { Permission } from 'src/modules/auth/entities/permission.entity';
import { RolePermission } from 'src/modules/auth/entities/role-permission.entity';
import { Role } from 'src/modules/auth/entities/role.entity';
import { AuthSeeder } from 'src/modules/auth/seeders/auth.seeder';
import { Setting } from 'src/modules/setting/entities/setting.entity';
import { SettingSeeder } from 'src/modules/setting/seeders/setting.seeder';
import { User } from 'src/modules/user/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    TypeOrmModule.forRoot({
      ...dataSource.options,
    }),
    TypeOrmModule.forFeature([
      Admin,
      ModuleEntity,
      Permission,
      Role,
      RolePermission,
      Setting,
      User,
    ]),
  ],
  providers: [AuthSeeder, SettingSeeder],
})
export class SeederModule {}
