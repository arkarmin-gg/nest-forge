process.env.TZ = 'UTC';

import type { Server } from 'node:http';
import {
  ClassSerializerInterceptor,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { winstonConfig } from './common/config/logger.config';
import {
  AllExceptionsFilter,
  DatabaseExceptionFilter,
  HttpExceptionFilter,
  ThrottlerExceptionFilter,
} from './common/filters';
import { TimeoutInterceptor } from './common/interceptors';
import { TrimPipe } from './common/pipes';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  const configService = app.get(ConfigService);
  const isProduction = configService.getOrThrow<boolean>('app.isProduction');

  // Security headers with Helmet — CSP enabled with sensible defaults
  // For Swagger UI in development, 'unsafe-inline' is needed for scripts/styles
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", ...(isProduction ? [] : ["'unsafe-inline'"])],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'", ...(isProduction ? [] : ["'unsafe-inline'"])],
        },
      },
      // HSTS must be off in dev — once sent, browsers enforce HTTPS-only for the
      // entire origin (including localhost), causing TLS errors on plain HTTP servers.
      hsts: isProduction,
    }),
  );

  // Environment-based CORS configuration
  const envOriginsRaw = configService.get<string>('cors.origins');
  let origins: string[] | boolean = [];

  const bootstrapLogger = new Logger('Bootstrap');

  if (envOriginsRaw) {
    const parsed = envOriginsRaw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    if (parsed.length === 1) {
      const val = parsed[0].toLowerCase();
      if (val === '*' || val === 'all' || val === 'true') {
        origins = true;
        bootstrapLogger.warn(
          'CORS is configured to allow ALL origins. ' +
            'This is only acceptable in local development. ' +
            'Set CORS_ORIGINS to specific domains in production.',
        );
      } else {
        origins = parsed;
      }
    } else if (parsed.length > 1) {
      origins = parsed;
    }
  }

  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'x-signature',
      'x-timestamp',
      'x-request-id',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['X-Request-ID'],
    credentials: true,
  });

  // Enable global validation pipe
  app.useGlobalPipes(
    new TrimPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable global serialization and timeout (10s default; slow routes override via @RequestTimeout)
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(reflector),
    new TimeoutInterceptor(reflector),
  );

  // Filter registration: NestJS routes exceptions to the most specific @Catch type first.
  // AllExceptionsFilter (@Catch()) is the final catch-all for anything not handled below.
  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new DatabaseExceptionFilter(),
    new HttpExceptionFilter(),
    new ThrottlerExceptionFilter(),
  );

  // Set global API prefix — produces /api/v1/... with URI versioning
  app.setGlobalPrefix('api');

  // Enable URI-based versioning (/api/v1/...)
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Enable graceful shutdown — triggers OnModuleDestroy across all modules
  app.enableShutdownHooks();

  const port = configService.getOrThrow<number>('app.port');
  const server = (await app.listen(port)) as Server;

  bootstrapLogger.log(`Application is running on port ${port}`);
  bootstrapLogger.log(
    `Environment: ${configService.getOrThrow<string>('app.nodeEnv')}`,
  );
  bootstrapLogger.log(
    `TZ: ${configService.getOrThrow<string>('app.timezone')}`,
  );

  // Graceful shutdown on SIGTERM (container restarts, PM2 reloads)
  process.on('SIGTERM', () => {
    void (async () => {
      bootstrapLogger.log('SIGTERM received. Shutting down gracefully...');
      await app.close();
      server.close(() => {
        bootstrapLogger.log('HTTP server closed.');
        process.exit(0);
      });
    })();
  });

  // Catch async errors that escape NestJS request scope (queue processors, scheduled jobs, etc.)
  process.on('unhandledRejection', (reason: unknown) => {
    bootstrapLogger.error(
      'Unhandled promise rejection',
      reason instanceof Error ? reason.stack : String(reason),
    );
  });

  // Catch synchronous errors that escape all try/catch boundaries
  process.on('uncaughtException', (error: Error) => {
    bootstrapLogger.error('Uncaught exception', error.stack);
    process.exit(1);
  });
}
void bootstrap();
