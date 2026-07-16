import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UserModule } from 'src/modules/user/user.module';
import { UserAppController } from './user/user-app.controller';

@Module({
  imports: [UserModule, AuthModule],
  controllers: [UserAppController],
})
export class AppApiModule {}
