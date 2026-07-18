import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from 'src/api/v1/admin/user/user.controller';
import { ActivityLogModule } from 'src/modules/log';
import { UserDevice } from './entities/user-device.entity';
import { User } from './entities/user.entity';
import { UserDeviceService } from './services/user-device.service';
import { UserService } from './services/user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserDevice]), ActivityLogModule],
  providers: [UserService, UserDeviceService],
  controllers: [UserController],
  exports: [UserService, UserDeviceService, TypeOrmModule],
})
export class UserModule {}
