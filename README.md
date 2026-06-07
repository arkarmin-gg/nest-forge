# nest-forge

A production-ready NestJS API foundation with integrated authentication, authorization, job queues, file storage, and caching. Built to serve as a robust starter for secure, scalable backend APIs with dual-tenant support (Users and Admins).

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [API Reference](#api-reference)
- [Authentication Flows](#authentication-flows)
- [Authorization](#authorization)
- [Architecture](#architecture)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Overview

**nest-forge** is a comprehensive NestJS boilerplate that eliminates the tedious setup phase of building a new API. It ships with a complete authentication system (OTP, OAuth, 2FA, JWT), role-based access control with granular permissions, activity/audit logging, async notification queues, and AWS S3 file uploads — all production-hardened and ready to extend.

---

## Features

### Authentication & Security
- **Dual authentication system** — separate auth flows for end-users and back-office admins
- **User authentication** — OTP-based phone registration, phone + password login, Google and Apple OAuth
- **Admin authentication** — email + password login with optional two-factor authentication (2FA)
- **Multi-step registration** — state machine flow: OTP verification → password setup → profile completion
- **JWT access tokens** with configurable expiration and SHA-256 hashed refresh tokens
- **Password reset** — OTP-based reset flow for both users and admins
- **Two-factor authentication** — TOTP-based 2FA for admin accounts with full enable/disable audit trail
- **Rate limiting** — global throttler (100 req/min), stricter limits on login and OTP endpoints
- **HTTP security hardening** — Helmet headers, CORS, request correlation IDs

### Authorization
- **Role-based access control (RBAC)** — hierarchical roles with a numeric rank system (1 = superadmin)
- **Granular permission system** — fine-grained per-action, per-module permissions (CREATE/READ/UPDATE/DELETE)
- **Declarative guards** — `@Roles()`, `@RequirePermissions()`, `@Public()` decorators
- **Resource ownership guard** — validates that the caller owns the resource they are modifying

### Infrastructure
- **PostgreSQL + TypeORM** — migrations-only workflow (`synchronize: false`)
- **Redis** — caching (600 s TTL) and BullMQ job queues
- **BullMQ queues** — async email and SMS notification processing
- **AWS S3 integration** — file uploads with presigned URL generation and automatic URL resolution in responses

### Observability
- **Activity logging** — automatically captures end-user actions via a global interceptor
- **Audit logging** — records admin changes with before/after values for sensitive operations
- **Structured error handling** — custom filters for HTTP, database, throttler, and unhandled exceptions
- **Health check endpoint** — database and memory health checks via `@nestjs/terminus`

### Developer Experience
- **Standardized response format** — `ResponseInterceptor` normalizes all success/error responses
- **Timeout handling** — global `TimeoutInterceptor` with per-endpoint `@RequestTimeout()` override
- **Database seeder** — `db:seed` / `db:reset` scripts for local development
- **Semantic versioning** — automated changelog and version bumps via `release` scripts

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | [NestJS](https://nestjs.com/) v11 |
| Language | TypeScript |
| ORM | [TypeORM](https://typeorm.io/) |
| Database | PostgreSQL |
| Cache / Queue | Redis + [BullMQ](https://bullmq.io/) |
| Auth | JWT, bcryptjs, OTP, OAuth (Google, Apple) |
| File Storage | AWS S3 |
| Validation | class-validator, class-transformer, Joi |
| Logging | Winston + nest-winston + daily-rotate-file |
| Scheduling | @nestjs/schedule |
| CLI | Commander |
| Testing | Jest |
| Process Manager | PM2 (production) |
| CI/CD | GitHub Actions |

---

## Project Structure

The project follows a **modular monolith** architecture with a clear separation between the API layer, domain modules, and infrastructure.

```
cli/                                # Forge CLI (commander-based)
│   ├── commands/
│   │   ├── db.ts                   # Registers `forge db` command group
│   │   ├── migrate.ts              # `forge db migrate generate|run|revert`
│   │   └── seed.ts                 # `forge db seed|clear|reset`
│   └── index.ts                    # CLI entry point
src/
├── api/v1/                         # API layer — controllers only (thin, no business logic)
│   ├── auth/                       # Auth, roles, and permissions controllers
│   ├── admin/                      # Admin CRUD controller
│   ├── user/                       # User CRUD controller
│   ├── log/                        # Activity & audit log controllers
│   └── setting/                    # Application settings controller
├── modules/                        # Domain layer — business logic, entities, DTOs
│   ├── auth/                       # Auth services, guards, strategies, decorators, entities
│   │   ├── decorators/             # @Public, @CurrentUser, @Roles, @RequirePermissions, @CheckOwnership
│   │   ├── dto/                    # Auth-related DTOs
│   │   ├── entities/               # Role, Permission, RolePermission, RefreshToken, Module entities
│   │   ├── events/                 # Domain events (e.g. TwoFactorCodeRequestedEvent)
│   │   ├── guards/                 # JwtAuthGuard, RolesGuard, PermissionsGuard, ResourceOwnershipGuard
│   │   ├── interfaces/             # AuthUser interface
│   │   ├── seeders/                # Auth seeder (roles, permissions, superadmin)
│   │   ├── services/               # AdminAuthService, UserAuthService, TokenService, etc.
│   │   └── strategies/             # JwtStrategy
│   ├── admin/                      # Admin entity, service, DTOs
│   ├── user/                       # User entity, service, DTOs
│   ├── otp/                        # OTP entity and service
│   ├── role/                       # Role module (re-exports from auth module)
│   ├── log/                        # Activity & audit logging
│   │   ├── constants/              # Log-related constants
│   │   ├── decorators/             # @LogActivity
│   │   ├── dto/                    # Log query DTOs
│   │   ├── entities/               # ActivityLog, AuditLog entities
│   │   ├── events/                 # Log domain events
│   │   ├── interceptors/           # ActivityLogInterceptor
│   │   ├── interfaces/             # Log payload interfaces
│   │   ├── listeners/              # LogListener (event → persistence)
│   │   ├── services/               # ActivityLogService, AuditLogService
│   │   └── utils/                  # Audit log metadata helpers
│   └── setting/                    # Setting entity, service, DTOs, seeder
├── infrastructure/                 # Infrastructure layer
│   ├── database/
│   │   └── migrations/             # TypeORM migration files
│   ├── health/                     # /health endpoint (database + memory checks)
│   └── notification/               # BullMQ email/SMS processors and event listeners
│       ├── constants/              # Queue name constants
│       ├── interfaces/             # Notification job payload interfaces
│       ├── listeners/              # TwoFactorCodeListener
│       └── processors/             # EmailProcessor, SmsProcessor
├── common/                         # Shared cross-cutting concerns
│   ├── config/                     # Environment validation (Joi schema), logger config
│   ├── decorators/                 # @RequestTimeout, @ResolvePresignedUrls
│   ├── dto/                        # Shared DTOs (pagination, filters)
│   ├── entities/                   # BaseEntity, AuditEntity
│   ├── filters/                    # Exception filters (HTTP, DB, throttler, catch-all)
│   ├── interceptors/               # ResponseInterceptor, TimeoutInterceptor, PresignedUrlInterceptor
│   ├── interfaces/                 # ApiResponse interface
│   ├── middleware/                 # RequestIdMiddleware
│   ├── pipes/                      # TrimPipe
│   ├── services/                   # FileUploadService, StartupService
│   ├── transaction/                # @Transactional decorator + AsyncLocalStorage context
│   ├── utils/                      # Email, SMS, OTP mock, password hash, S3 client, etc.
│   └── validators/                 # Custom class-validator validators (NRC format, password)
├── seeders/                        # Root seeder entry points (seed.ts, clear.ts)
├── types/                          # Global TypeScript type extensions
├── main.ts                         # Application bootstrap
├── app.module.ts                   # Root module
└── data-source.ts                  # TypeORM DataSource for CLI migrations
```

---

## Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **PostgreSQL** >= 14
- **Redis** >= 6

For local development, the easiest way to get PostgreSQL and Redis running is with Docker:

```bash
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker run -d --name redis -p 6379:6379 redis:7
```

---

## Getting Started

**1. Clone the repository**

```bash
git clone https://github.com/your-org/nest-forge.git
cd nest-forge
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

```bash
cp .env.example .env
# Edit .env with your local values
```

**4. Run database migrations**

```bash
npm run migration:run
```

**5. Seed initial data** (roles, permissions, default superadmin)

```bash
npm run db:seed
```

**6. Start the development server**

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`.

---

## Environment Variables

All variables are validated on startup using a Joi schema defined in [src/common/config/env.validation.ts](src/common/config/env.validation.ts) and [src/common/config/logger.config.ts](src/common/config/logger.config.ts). The application refuses to start if required values are missing or malformed.

### Required

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | HTTP server port | `3000` |
| `APP_NAME` | Application name used in notifications | `"My App"` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_NAME` | PostgreSQL database name | `nest_forge_db` |
| `JWT_SECRET` | Secret for signing access tokens (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens (min 32 chars) | — |
| `JWT_EXPIRATION` | Access token TTL in milliseconds | `900000` (15 min) |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL in milliseconds | `2592000000` (30 days) |
| `AUTH_PASSWORD_SALT_ROUNDS` | bcrypt salt rounds | `10` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated or `*`) | `https://app.example.com` |
| `SMTP_FROM_NAME` | Display name for outgoing emails | `"My App"` |

### Optional

| Variable | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS credentials for S3 file uploads |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | S3 bucket region (default: `ap-southeast-1`) |
| `AWS_BUCKET_NAME` | S3 bucket name |
| `AWS_ENDPOINT` | Custom S3-compatible endpoint (e.g. MinIO) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `APPLE_CLIENT_ID` | Apple OAuth client ID |
| `OTP_MOCK_ENABLED` | Bypass real OTP delivery in development (`true`/`false`) |
| `OTP_MOCK_CODE` | Fixed OTP code when mocking is enabled (e.g. `000000`) |
| `SMS_MOCK_ENABLED` | Bypass real SMS delivery in development |
| `SMS_POH_API_KEY` | SMS provider (Plain Old HTML) API key |
| `SMS_POH_API_SECRET_KEY` | SMS provider secret key |
| `SMS_POH_BASE_API_URL` | SMS provider base URL |
| `SMS_POH_API_BRAND` | SMS provider brand name |
| `SMS_POH_API_SENDER_ID` | SMS sender ID |

---

## Database

### Migrations

This project uses TypeORM migrations exclusively — `synchronize` is disabled in all environments. Migration files live in `src/infrastructure/database/migrations/`. Never edit a migration file after it has been applied to any environment.

```bash
# Generate a new migration from entity changes
npm run migration:generate -- src/database/migrations/MigrationName

# Apply pending migrations (development)
npm run migration:run

# Apply pending migrations (production — uses compiled JS in dist/)
npm run migration:run:prod

# Revert the last applied migration
npm run migration:revert
```

### Seeding

```bash
npm run db:seed    # Seed initial roles, permissions, and a default superadmin
npm run db:clear   # Truncate all seeded tables
npm run db:reset   # db:clear followed by db:seed
```

### Core Entities

| Entity | Description |
|---|---|
| `User` | End-users — phone, email, OAuth IDs, registration stage, profile image |
| `Admin` | Back-office operators — email, password, role assignment, 2FA status |
| `Role` | Permission groups with a numeric rank (1 = superadmin, 99 = lowest) |
| `Permission` | Fine-grained actions (CREATE/READ/UPDATE/DELETE) scoped to a module |
| `RolePermission` | Join table for role → permission assignments |
| `ModuleEntity` | Hierarchical resource areas (supports parent → child nesting) |
| `RefreshToken` | Hashed long-lived tokens with expiry and revocation support |
| `OtpRecord` | Temporary verification codes with attempt tracking and auto-expiry |
| `ActivityLog` | End-user action records (IP, user-agent, resource, action) |
| `AuditLog` | Admin change records with old/new values for sensitive operations |
| `Setting` | Key-value application configuration (e.g. SMTP credentials) |

---

## API Reference

All versioned endpoints are prefixed with `/v1`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/auth/admin/login` | Public | Admin login (email + password) |
| `POST` | `/v1/auth/user/login` | Public | User login (phone + password) |
| `POST` | `/v1/auth/user/login/google` | Public | Google OAuth login |
| `POST` | `/v1/auth/user/login/apple` | Public | Apple OAuth login |
| `POST` | `/v1/auth/register/otp` | Public | Request registration OTP |
| `POST` | `/v1/auth/register/otp/verify` | Public | Verify registration OTP |
| `POST` | `/v1/auth/register/password` | Public | Set password (after OTP verified) |
| `POST` | `/v1/auth/register` | Public | Complete registration with profile image (multipart) |
| `POST` | `/v1/auth/refresh` | Public | Exchange refresh token for new access token |
| `POST` | `/v1/auth/logout` | JWT | Revoke refresh token |
| `GET` | `/v1/auth/me` | JWT | Get authenticated user profile |
| `PATCH` | `/v1/auth/me` | JWT | Update profile (multipart) |
| `PUT` | `/v1/auth/me/password` | JWT | Change password |
| `DELETE` | `/v1/auth/me` | JWT | Delete own account |
| `POST` | `/v1/auth/2fa/verify` | JWT | Verify 2FA code during login |
| `POST` | `/v1/auth/2fa/enable` | JWT | Request 2FA enable (sends OTP) |
| `POST` | `/v1/auth/2fa/enable/confirm` | JWT | Confirm 2FA setup |
| `POST` | `/v1/auth/2fa/disable` | JWT | Disable 2FA |
| `POST` | `/v1/auth/admin/forgot-password` | Public | Request admin password reset OTP |
| `POST` | `/v1/auth/admin/forgot-password/verify` | Public | Verify password reset OTP |
| `POST` | `/v1/auth/admin/reset-password` | Public | Reset admin password |
| `POST` | `/v1/auth/user/forgot-password` | Public | Request user password reset OTP |
| `POST` | `/v1/auth/user/forgot-password/verify` | Public | Verify user password reset OTP |
| `POST` | `/v1/auth/user/reset-password` | Public | Reset user password |

### Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/users` | JWT + Permission | Create user |
| `GET` | `/v1/users` | JWT + Permission | List users (paginated, filterable) |
| `GET` | `/v1/users/:id` | JWT + Permission | Get user details |
| `PATCH` | `/v1/users/:id` | JWT + Permission | Update user (multipart) |
| `DELETE` | `/v1/users/:id` | JWT + Permission | Delete user |

### Admins

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/admins` | JWT + Permission | Create admin |
| `GET` | `/v1/admins` | JWT + Permission | List admins (paginated, filterable) |
| `GET` | `/v1/admins/:id` | JWT + Permission | Get admin details |
| `PATCH` | `/v1/admins/:id` | JWT + Permission | Update admin |
| `DELETE` | `/v1/admins/:id` | JWT + Permission | Delete admin |

### Roles & Permissions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/v1/roles` | JWT + Permission | Create role |
| `GET` | `/v1/roles` | JWT + Permission | List roles |
| `GET` | `/v1/roles/:id` | JWT + Permission | Get role with its permissions |
| `PATCH` | `/v1/roles/:id` | JWT + Permission | Update role |
| `DELETE` | `/v1/roles/:id` | JWT + Permission | Delete role |
| `GET` | `/v1/permissions` | JWT | List all available permissions |
| `POST` | `/v1/role-permissions` | JWT + Permission | Assign a permission to a role |

### Logs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/activity-logs` | JWT + Permission | Query user activity logs |
| `GET` | `/v1/audit-logs` | JWT + Permission | Query admin audit logs |

### Settings

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/settings/smtp` | JWT + Permission | Get SMTP configuration |
| `PUT` | `/v1/settings/smtp` | JWT + Permission | Update SMTP configuration |

### System

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Health check (database + memory) |
| `GET` | `/` | Public | Welcome endpoint |

### Response Envelope

All responses use a consistent shape:

**Success**
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": { },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

**Error**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["email must be a valid email address"]
}
```

---

## Authentication Flows

### User Registration (OTP-based)

```
1. POST /v1/auth/register/otp          → Send OTP to phone number
2. POST /v1/auth/register/otp/verify   → Verify OTP  →  stage: OTP_VERIFIED
3. POST /v1/auth/register/password     → Set password  →  stage: PASSWORD_SET
4. POST /v1/auth/register              → Upload profile image, complete signup  →  stage: COMPLETED
```

### Admin Login with Two-Factor Authentication

```
1. POST /v1/auth/admin/login  →  { requiresTwoFactor: true, tempToken }
2. POST /v1/auth/2fa/verify   →  { accessToken, refreshToken }
```

### Token Refresh

```
POST /v1/auth/refresh
Body: { "refreshToken": "<token>" }
→ Returns: { accessToken, refreshToken }
```

Refresh tokens are stored as SHA-256 hashes. A new refresh token is issued on every refresh, and the previous one is automatically invalidated.

---

## Authorization

### Guard Chain

Three guards run globally on every request (in order):

1. **JwtAuthGuard** — validates the `Authorization: Bearer <token>` header. Routes decorated with `@Public()` bypass this guard entirely.
2. **RolesGuard** — checks that the caller's role matches the roles declared with `@Roles()`.
3. **PermissionsGuard** — checks that the caller's role has the specific permission declared with `@RequirePermissions()`.

### Decorators

```typescript
// Skip JWT authentication entirely  [modules/auth/decorators]
@Public()

// Require the caller to have one of these roles  [modules/auth/decorators]
@Roles('superadmin', 'manager')

// Require a specific permission  [modules/auth/decorators]
@RequirePermissions({ action: 'DELETE', module: 'USER' })

// Inject the authenticated user into a controller parameter  [modules/auth/decorators]
@CurrentUser() user: AuthUser

// Assert that the authenticated user owns the target resource  [modules/auth/decorators]
@CheckOwnership()

// Override the default request timeout for this endpoint  [common/decorators]
@RequestTimeout(5000)

// Auto-resolve S3 presigned URLs for the named field in the response  [common/decorators]
@ResolvePresignedUrls('profileImageUrl')

// Emit an activity log entry when this endpoint is called  [modules/log/decorators]
@LogActivity({ action: 'UPDATE', resourceType: 'USER' })
```

---

## Architecture

### Modular Monolith Layers

| Layer | Path | Responsibility |
|---|---|---|
| **API** | `src/api/v1/` | Controllers — route binding, request parsing, response shaping |
| **Domain** | `src/modules/` | Business logic, entities, domain events, guards, decorators |
| **Infrastructure** | `src/infrastructure/` | Database migrations, health checks, async notification queues |
| **Common** | `src/common/` | Cross-cutting concerns shared across all layers |

### Request Lifecycle

```
Incoming Request
  └── RequestIdMiddleware             Assigns X-Request-ID correlation header
  └── ThrottlerGuard                  Enforces rate limits
  └── JwtAuthGuard                    Validates JWT, populates request.user
  └── RolesGuard                      Checks role requirements
  └── PermissionsGuard                Checks permission requirements
  └── TimeoutInterceptor              Enforces request timeout
  └── ActivityLogInterceptor          Captures action metadata for logging
  └── ResponseInterceptor             Wraps response in standard envelope
  └── Controller / Service            Business logic
  └── PresignedUrlInterceptor         Resolves S3 presigned URLs
  └── Outgoing Response
```

### Async Notification Flow

Email and SMS notifications are decoupled from the request lifecycle via BullMQ:

```
Event fired (e.g. 2FA code requested)
  └── EventEmitter2 → TwoFactorCodeListener (infrastructure/notification/listeners)
  └── Job added to BullMQ email or SMS queue
  └── EmailProcessor / SmsProcessor picks up job  (infrastructure/notification/processors)
  └── Notification sent
```

### Transaction Management

The `@Transactional()` decorator wraps a service method in a TypeORM transaction and propagates the `EntityManager` via `AsyncLocalStorage`, so repository calls anywhere in the call stack automatically participate in the same transaction without manual wiring.

```typescript
@Transactional()
async transferFunds(fromId: string, toId: string, amount: number): Promise<void> {
  // All repository operations here share one transaction — committed or rolled back together
}
```

---

## Scripts

### npm scripts

| Script | Description |
|---|---|
| `npm run start:dev` | Start with watch mode (development) |
| `npm run start:prod` | Start compiled output (production) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run build:low-mem` | Compile with 1536 MB memory cap for constrained environments |
| `npm run lint` | ESLint with auto-fix |
| `npm run format` | Prettier formatting |
| `npm run test` | Run unit tests |
| `npm run test:cov` | Run tests with coverage report |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run migration:generate -- src/database/migrations/Name` | Generate migration from entity changes |
| `npm run migration:run` | Apply pending migrations (dev) |
| `npm run migration:run:prod` | Apply pending migrations (prod, compiled) |
| `npm run migration:revert` | Revert last migration (dev) |
| `npm run migration:revert:prod` | Revert last migration (prod, compiled) |
| `npm run db:seed` | Seed initial roles, permissions, and a default admin |
| `npm run db:clear` | Truncate seeded tables |
| `npm run db:reset` | db:clear + db:seed |
| `npm run release` | Bump patch version + update CHANGELOG |
| `npm run release:minor` | Bump minor version + update CHANGELOG |
| `npm run release:major` | Bump major version + update CHANGELOG |

### forge CLI

The `forge` CLI (in `cli/`) wraps common database operations under a single unified interface:

```bash
# Generate a new migration (output goes to src/infrastructure/database/migrations/)
npx ts-node cli/index.ts db migrate generate <MigrationName>

# Apply pending migrations
npx ts-node cli/index.ts db migrate run

# Revert the last applied migration
npx ts-node cli/index.ts db migrate revert

# Seed initial data
npx ts-node cli/index.ts db seed

# Truncate seeded tables
npx ts-node cli/index.ts db clear

# Clear then re-seed
npx ts-node cli/index.ts db reset
```

---

## Deployment

### GitHub Actions

The included workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) triggers on push to the `dev` branch and:

1. Runs on a Node 24 runner
2. Installs dependencies and builds the project
3. Uploads the `dist/` artifact to the target server via SCP
4. SSHs into the server, runs `npm run migration:run:prod`
5. Restarts the application using PM2

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong, unique values for `JWT_SECRET` and `JWT_REFRESH_SECRET` (min 32 characters, generated randomly)
- [ ] Set `OTP_MOCK_ENABLED=false` and `SMS_MOCK_ENABLED=false`
- [ ] Configure real SMTP credentials via the `/v1/settings/smtp` endpoint
- [ ] Restrict `CORS_ORIGINS` to your actual frontend domains
- [ ] Enable HTTPS via a reverse proxy (Nginx, Caddy, etc.)
- [ ] Set up automated database backups
- [ ] Pin a PM2 ecosystem file for reliable process management

### PM2 Quick Start

```bash
npm run build
npm run migration:run:prod
pm2 start dist/main.js --name nest-forge
pm2 save
```

---

## Contributing

1. Fork the repository and create a feature branch from `dev`
2. Follow the existing module structure and naming conventions
3. Run `npm run lint` and `npm run test` before opening a pull request
4. Open a pull request against the `dev` branch with a clear description of what changed and why

---

## License

MIT
