import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envValidationSchema } from 'src/common/config';
import dataSource from '../data-source';
import { Admin } from 'src/modules/admin/entities/admin.entity';
import { AdminSeeder } from 'src/modules/admin/seeders/admin.seeder';
import { ModuleEntity } from 'src/modules/role/entities/module.entity';
import { Permission } from 'src/modules/role/entities/permission.entity';
import { RolePermission } from 'src/modules/role/entities/role-permission.entity';
import { Role } from 'src/modules/role/entities/role.entity';
import { RoleSeeder } from 'src/modules/role/seeders/role.seeder';
import { Setting } from 'src/modules/setting/entities/setting.entity';
import { SettingSeeder } from 'src/modules/setting/seeders/setting.seeder';
import { User } from 'src/modules/user/entities/user.entity';
import { UserSeeder } from 'src/modules/user/seeders/user.seeder';

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
  providers: [RoleSeeder, AdminSeeder, UserSeeder, SettingSeeder],
})
export class SeederModule {}
