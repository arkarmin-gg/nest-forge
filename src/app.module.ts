import { createKeyv } from '@keyv/redis';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import { RoleApiModule } from 'src/api/v1/admin/role/role-api.module';
import { AppApiModule } from 'src/api/v1/app/app-api.module';
import { HealthModule } from 'src/infrastructure/health/health.module';
import { NotificationModule } from 'src/infrastructure/notification/notification.module';
import { AdminModule } from 'src/modules/admin/admin.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { JwtAuthGuard } from 'src/modules/auth';
import { ActivityLogModule } from 'src/modules/log';
import { SettingModule } from 'src/modules/setting';
import { UserModule } from 'src/modules/user';
import { CommonModule } from './common/common.module';
import {
  appConfig,
  authConfig,
  corsConfig,
  databaseConfig,
  jwtConfig,
  otpConfig,
  redisConfig,
  s3Config,
  seedConfig,
  smsConfig,
  validateEnv,
} from './common/config';
import { RequestIdMiddleware } from './common/middleware';
import dataSource from './data-source';

@Module({
  imports: [
    CommonModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    NotificationModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        authConfig,
        corsConfig,
        databaseConfig,
        jwtConfig,
        otpConfig,
        redisConfig,
        s3Config,
        seedConfig,
        smsConfig,
      ],
      validate: validateEnv,
      validatePredefined: false,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        stores: [
          createKeyv({
            url: `redis://${configService.getOrThrow<string>('redis.host')}:${configService.getOrThrow<number>('redis.port')}`,
          }),
        ],
        ttl: 600 * 1000,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRoot({
      ...dataSource.options,
    }),
    ClsModule.forRoot({
      plugins: [
        new ClsPluginTransactional({
          imports: [TypeOrmModule],
          adapter: new TransactionalAdapterTypeOrm({
            dataSourceToken: getDataSourceToken(),
          }),
        }),
      ],
    }),
    AuthModule,
    ActivityLogModule,
    UserModule,
    AdminModule,
    RoleApiModule,
    AppApiModule,
    SettingModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
