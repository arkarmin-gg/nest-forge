import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UserModule } from 'src/modules/user';
import { UserDeviceAppController } from './user/user-device-app.controller';
import { UserAppController } from './user/user-app.controller';

@Module({
  imports: [UserModule, AuthModule],
  controllers: [UserAppController, UserDeviceAppController],
})
export class AppApiModule {}
