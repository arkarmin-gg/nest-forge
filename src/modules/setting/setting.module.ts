import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingController } from 'src/api/v1/admin/setting/setting.controller';
import { SettingService } from './services/setting.service';
import { Setting } from './entities/setting.entity';
import { SettingSeeder } from './seeders/setting.seeder';

@Module({
  imports: [TypeOrmModule.forFeature([Setting])],
  controllers: [SettingController],
  providers: [SettingService, SettingSeeder],
  exports: [SettingService],
})
export class SettingModule {}
