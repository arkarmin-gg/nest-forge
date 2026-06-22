# nest-forge — Architecture & Development Standards

> **Audience:** Backend developers joining the nest-forge ecosystem.
> **Purpose:** Understand how the project is structured, why decisions were made, and how to contribute correctly.

---

## Table of Contents

1. [What Is Modular Monolith?](#1-what-is-modular-monolith)
2. [Technology Stack](#2-technology-stack)
3. [Project Directory Structure](#3-project-directory-structure)
4. [The Four-Zone Architecture](#4-the-four-zone-architecture)
5. [Module Structure — The Golden Template](#5-module-structure--the-golden-template)
6. [Request Lifecycle](#6-request-lifecycle)
7. [Response Format Standards](#7-response-format-standards)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Database & Entity Standards](#9-database--entity-standards)
10. [Error Handling](#10-error-handling)
11. [Logging & Observability](#11-logging--observability)
12. [File Uploads (AWS S3)](#12-file-uploads-aws-s3)
13. [Async Notifications (BullMQ)](#13-async-notifications-bullmq)
14. [Validation Standards](#14-validation-standards)
15. [Transaction Management](#15-transaction-management)
16. [Key Decorators Reference](#16-key-decorators-reference)
17. [Environment Variables](#17-environment-variables)
18. [Database Migrations & Seeding](#18-database-migrations--seeding)
19. [Best Practices & Rules](#19-best-practices--rules)
20. [Common Mistakes to Avoid](#20-common-mistakes-to-avoid)
21. [Adding a New Module — Step-by-Step](#21-adding-a-new-module--step-by-step)

---

## 1. What Is Modular Monolith?

### The Problem With Two Extremes

| Traditional Monolith                       | Microservices                                           |
| ------------------------------------------ | ------------------------------------------------------- |
| Fast to start, turns into a spaghetti mess | Clean boundaries, but complex infrastructure            |
| One codebase, zero network overhead        | Network latency, distributed tracing, service discovery |
| Hard to scale specific parts               | Scale each service independently                        |
| Refactoring is painful and risky           | Independent deployment, but huge operational cost       |

**Modular Monolith** sits in the sweet spot:

- **One deployable unit** (monolith) — simple CI/CD, no network overhead between modules
- **Strict domain boundaries** (modular) — each module owns its data, logic, and API
- **Migration-ready** — if a module needs to become a microservice, boundaries are already clean

### Core Principles

```
┌─────────────────────────────────────────────────────┐
│                     API Layer                        │
│         (HTTP Controllers — thin, no logic)          │
├─────────────────────────────────────────────────────┤
│                   Domain Layer                       │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│   │   Auth   │  │   User   │  │   Setting  ...   │  │
│   │  Module  │  │  Module  │  │   Module         │  │
│   └──────────┘  └──────────┘  └──────────────────┘  │
│   Each module = its own entities, services, DTOs     │
├─────────────────────────────────────────────────────┤
│                Infrastructure Layer                  │
│      (Database, Queues, Health — no biz logic)       │
├─────────────────────────────────────────────────────┤
│                   Common Layer                       │
│     (Shared decorators, filters, interceptors)       │
└─────────────────────────────────────────────────────┘
```

**Rule:** Layers only communicate downward. API → Domain → Infrastructure. Domain modules communicate through **service interfaces**, never through direct database access into another module's entities.

---

## 2. Technology Stack

| Category        | Technology                          | Version    |
| --------------- | ----------------------------------- | ---------- |
| Framework       | NestJS                              | v11        |
| Language        | TypeScript                          | 5.9        |
| Database        | PostgreSQL + TypeORM                | 0.3        |
| Cache / Queues  | Redis + BullMQ                      | Latest     |
| Auth            | JWT + bcryptjs + Passport           | —          |
| File Storage    | AWS S3                              | —          |
| Validation      | class-validator + class-transformer | —          |
| Env Validation  | Joi                                 | —          |
| Logging         | Winston + daily-rotate-file         | —          |
| Testing         | Jest                                | —          |
| Process Manager | PM2                                 | Production |

---

## 3. Project Directory Structure

```
nest-forge/
├── src/
│   ├── api/v1/                      ← HTTP Layer (Controllers ONLY)
│   │   ├── admin/                   # ADMIN subject surface → /api/v1/admin/*
│   │   │   ├── admin/admin.controller.ts
│   │   │   ├── user/user.controller.ts
│   │   │   ├── role/                (role + permissions controllers)
│   │   │   ├── log/log.controller.ts
│   │   │   └── setting/setting.controller.ts
│   │   ├── app/                     # USER subject surface → /api/v1/app/*
│   │   │   └── user/user-app.controller.ts
│   │   └── auth/                    # shared (mostly @Public) login/register
│   │       └── auth.controller.ts
│   │
│   ├── modules/                     ← Domain Layer (Business Logic)
│   │   ├── auth/                    # Auth, RBAC, JWT, guards, strategies
│   │   │   ├── decorators/
│   │   │   ├── dto/
│   │   │   ├── entities/
│   │   │   ├── events/
│   │   │   ├── guards/
│   │   │   ├── interfaces/
│   │   │   ├── seeders/
│   │   │   ├── services/
│   │   │   ├── strategies/
│   │   │   ├── auth.module.ts
│   │   │   └── index.ts             # Public API barrel — always import from here
│   │   ├── user/
│   │   │   ├── dto/
│   │   │   ├── entities/
│   │   │   ├── services/
│   │   │   ├── user.module.ts
│   │   │   └── index.ts
│   │   ├── admin/
│   │   ├── otp/
│   │   ├── log/
│   │   ├── setting/
│   │   └── role/                    # RBAC — roles, permissions, guards (standalone module)
│   │
│   ├── infrastructure/              ← Technical Plumbing (No Business Logic)
│   │   ├── database/
│   │   │   └── migrations/          # TypeORM migrations
│   │   ├── health/                  # /health endpoint
│   │   └── notification/            # BullMQ email/SMS queues
│   │
│   ├── common/                      ← Shared Cross-Cutting Concerns
│   │   ├── config/                  # Env validation, logger config
│   │   ├── decorators/              # @RequestTimeout, @ResolvePresignedUrls
│   │   ├── dto/                     # PaginationFilterDto
│   │   ├── entities/                # BaseEntity, AuditEntity
│   │   ├── filters/                 # Exception filters
│   │   ├── interceptors/            # Response, Timeout, PresignedUrl
│   │   ├── interfaces/              # ApiResponse<T>
│   │   ├── middleware/              # RequestId middleware
│   │   ├── pipes/                   # TrimPipe (global string trimming)
│   │   ├── services/                # FileUploadService, StartupService
│   │   ├── transaction/             # @Transactional decorator
│   │   ├── utils/                   # S3, email, SMS, password, date utils
│   │   └── validators/              # Custom validators (NRC, password)
│   │
│   ├── seeders/                     # Database seeding scripts
│   ├── types/                       # TypeScript ambient declarations
│   ├── app.module.ts                # Root module
│   ├── main.ts                      # Entry point
│   └── data-source.ts               # TypeORM DataSource config
│
├── cli/                             # forge CLI — database operations
│   ├── index.ts                     # Entry point: `forge` binary
│   └── commands/
│       ├── db.ts                    # `forge db` command group
│       ├── migrate.ts               # `forge db migrate *` sub-commands
│       └── seed.ts                  # `forge db seed/clear/reset` sub-commands
├── logs/                            # Winston daily log files
├── dist/                            # Compiled output
└── ...config files
```

---

## 4. The Four-Zone Architecture

Understanding these four zones is **mandatory** before writing any code.

### Zone 1: `api/v1/` — HTTP Layer

**Responsibility:** Receive HTTP requests, delegate to services, return responses.

**Rules:**

- Controllers contain **zero business logic**
- No database queries, no data transformation
- Only call service methods and return the result
- Always version under `v1/` (or `v2/` for new versions)

```typescript
// ✅ CORRECT — thin controller
@Post()
@LogActivity({ action: LogAction.CREATE, description: 'Admin created' })
async create(@Body() dto: CreateAdminDto) {
  return this.adminService.create(dto);
}

// ❌ WRONG — business logic in controller
@Post()
async create(@Body() dto: CreateAdminDto) {
  const existing = await this.adminRepository.findOne({ where: { email: dto.email } });
  if (existing) throw new ConflictException('Email taken');
  const hashed = await bcrypt.hash(dto.password, 10);
  return this.adminRepository.save({ ...dto, password: hashed });
}
```

#### API Audience Zones — `admin/` vs `app/`

The `api/v1/` layer is partitioned by **audience** (the Subject type that consumes it — see ADR-0006):

```
src/api/v1/
├── admin/   ← ADMIN subject surface — routes /api/v1/admin/*  (back-office)
├── app/     ← USER subject surface  — routes /api/v1/app/*    (mobile/web end-user)
└── auth/    ← shared, mostly @Public — login/register for both subjects
```

**Rules for placing a new controller:**

- A back-office endpoint goes under `api/v1/admin/<resource>/`, route prefix `admin/...`, gated by `PermissionsGuard` + `@RequirePermissions`. It may return raw entities (passive serialization).
- An end-user endpoint goes under `api/v1/app/<resource>/`, route prefix `app/...`, gated by `SubjectGuard` + `@RequireSubject('USER')`. It **must** map to a whitelist response DTO (see §7) and derive the target from `@CurrentUser()` — never a `:id` path param.
- Domain services in `modules/` stay audience-agnostic and are reused by both zones; the audience-specific shaping lives in the controller.

Reference example: `src/api/v1/app/user/user-app.controller.ts` (`GET`/`PATCH /api/v1/app/me`).

### Zone 2: `modules/` — Domain Layer

**Responsibility:** All business logic. This is where your application's value lives.

Each module contains:

- `entities/` — TypeORM entities (the data model)
- `dto/` — Data Transfer Objects for input validation
- `services/` — Business logic
- `events/` — Domain events for cross-module communication
- `index.ts` — Module wiring and domain types (module class, entities, events)
- `api.ts` — Services, DTOs, and route decorators (no re-exports of `index.ts` symbols)

**Rules:**

- A module **only accesses its own entities**
- To use another module's data, call that module's **exported service**
- Always expose both `index.ts` and `api.ts` barrels — no symbol appears in both
- Controllers always import from `api.ts` — services, DTOs, and route decorators live there
- Domain services import services from `api.ts`; entities and events from `index.ts`

### Zone 3: `infrastructure/` — Technical Layer

**Responsibility:** Database migrations, health checks, message queues. No business logic.

### Zone 4: `common/` — Shared Layer

**Responsibility:** Reusable technical utilities shared across all modules.

Includes: filters, interceptors, base entities, shared DTOs, utility functions.

---

## 5. Module Structure — The Golden Template

Every new domain module **must** follow this exact structure:

```
modules/
└── product/                         ← Your new module
    ├── dto/
    │   ├── create-product.dto.ts
    │   ├── update-product.dto.ts
    │   └── filter-product.dto.ts
    ├── entities/
    │   └── product.entity.ts
    ├── services/
    │   └── product.service.ts
    ├── product.module.ts
    ├── index.ts                     ← Full domain public API (for other modules)
    └── api.ts                       ← HTTP surface (for controllers only)
```

### `index.ts` vs `api.ts` — Two Barrels, Two Audiences

Every module exposes two barrel files with a **strict no-overlap rule**: if a symbol is in `api.ts` it must not appear in `index.ts`, and vice versa. Each symbol has exactly one canonical home.

|                   | `index.ts`                                                                  | `api.ts`                                            |
| ----------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| **Used by**       | Other domain modules, `app.module.ts`                                       | Controllers in `src/api/v1/` only                   |
| **Exports**       | Module class, entities, events, domain interfaces, guards used as providers | DTOs, services, decorators for routes               |
| **Never exports** | DTOs, route decorators, route guards                                        | Module class, entities, events, internal interfaces |

**`index.ts` — Module wiring and domain types**

```typescript
// modules/product/index.ts
export { ProductModule } from './product.module'; // ← module class, for app.module.ts
export { Product } from './entities/product.entity'; // ← entity, for domain services that need the type
export { ProductCreatedEvent } from './events/product-created.event'; // ← events
// No ProductService — services live in api.ts
// No DTOs — DTOs live in api.ts
```

**`api.ts` — Services, DTOs, and route decorators**

```typescript
// modules/product/api.ts
export { ProductService } from './services/product.service'; // ← service, for both controllers and domain services
export { CreateProductDto } from './dto/create-product.dto';
export { UpdateProductDto } from './dto/update-product.dto';
export { FilterProductDto } from './dto/filter-product.dto';
// No ProductModule — controllers don't register modules
// No Product entity — controllers never handle raw entities
// No events — domain services import those from index.ts
```

**Import rules:**

```typescript
// ✅ Controller importing — always use api.ts
// src/api/v1/product/product.controller.ts
import { ProductService, CreateProductDto } from 'src/modules/product/api';

// ✅ Domain service calling another module's service — use api.ts (services live there)
// src/modules/order/services/order.service.ts
import { ProductService } from 'src/modules/product/api';

// ✅ Domain service needing an entity type or event — use index.ts
// src/modules/order/services/order.service.ts
import { Product } from 'src/modules/product';
import { ProductCreatedEvent } from 'src/modules/product';

// ❌ WRONG — deep import bypasses module boundary
import { ProductService } from 'src/modules/product/services/product.service';

// ❌ WRONG — controller importing from index.ts (no services or DTOs there)
import { Product, ProductModule } from 'src/modules/product';

// ❌ WRONG — importing a service from index.ts (it no longer lives there)
import { ProductService } from 'src/modules/product';
```

The no-overlap rule means every symbol has exactly one canonical import path. There is no need to guess which barrel to check.

### Automated Enforcement (ESLint)

These boundaries are enforced mechanically by `eslint.config.mjs`, so `npm run lint` fails on a violation:

- **`no-restricted-imports`** blocks deep imports into a module's internals (e.g. `src/modules/auth/services/token.service`) — you must import through the `index.ts` / `api.ts` barrel. `*.entity.ts` files are exempt, since TypeORM relations legitimately reach across module internals.
- **`import-x/no-cycle`** (error) rejects circular import dependencies between files. Entity files are exempt because bidirectional TypeORM relations (e.g. `User` ↔ `RefreshToken`) form intentional, lazily-resolved cycles.

An architecture violation surfaces as a lint error, not a runtime surprise.

---

## 6. Request Lifecycle

Every HTTP request passes through this pipeline in order:

```
Incoming HTTP Request
        │
        ▼
┌─────────────────────┐
│  RequestIdMiddleware │  Generates/reads X-Request-ID header
└─────────────────────┘
        │
        ▼
┌──────────────────────┐
│    ThrottlerGuard    │  Rate limiting (global: 100 req/min)
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│     JwtAuthGuard     │  Validates JWT, attaches request.user
│  (skips if @Public)  │  request.user = { sub, subjectType, roleId, ... }
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│  RolesGuard /        │  Checks @RequireRoles() / @RequirePermissions()
│  PermissionsGuard    │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ ResourceOwnership    │  Validates @CheckOwnership() if present
│      Guard           │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│  TimeoutInterceptor  │  Enforces 10s default timeout
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ ActivityLog          │  Captures @LogActivity metadata
│  Interceptor         │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│      TrimPipe        │  Strips leading/trailing whitespace from all body & query strings
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│  ValidationPipe      │  Validates & transforms DTO fields (whitelist, forbidNonWhitelisted)
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│  Controller Method   │  Your handler runs here
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ ResponseInterceptor  │  Wraps result in standardized ApiResponse<T>
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ PresignedUrl         │  Converts S3 file keys to presigned URLs
│  Interceptor         │
└──────────────────────┘
        │
        ▼
┌──────────────────────┐
│ ClassSerializer      │  Strips @Exclude() fields (passwords, etc.)
│  Interceptor         │
└──────────────────────┘
        │
        ▼
     HTTP Response
```

> **Where each piece is actually registered** (the diagram shows logical order, not one file):
>
> - `RequestIdMiddleware` — `app.module.ts` via `configure(consumer)`.
> - Global guards — **only** `JwtAuthGuard` and `ThrottlerGuard`, as `APP_GUARD` providers in [app.module.ts](src/app.module.ts). `RolesGuard`/`PermissionsGuard`/`ResourceOwnershipGuard`/`SubjectGuard` are **not** global — they run only where a handler/controller adds `@UseGuards(...)`.
> - `TrimPipe` then `ValidationPipe` — `app.useGlobalPipes(...)` in [main.ts](src/main.ts).
> - Interceptors are spread across files: `ClassSerializerInterceptor` + `TimeoutInterceptor` in `main.ts`; `ActivityLogInterceptor` as `APP_INTERCEPTOR` in `app.module.ts`; `PresignedUrlInterceptor` + `ResponseInterceptor` as `APP_INTERCEPTOR` in [common.module.ts](src/common/common.module.ts). NestJS runs interceptors' pre-controller logic in registration order and their post-controller (response) logic in reverse, so on the way out `ResponseInterceptor` wraps first, then presigned-URL resolution, etc.

---

## 7. Response Format Standards

**All** API responses — success and error — follow a unified structure. The `ResponseInterceptor` handles this automatically.

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": {},
  "apiVersion": "v1",
  "timestamp": "2025-06-07T12:00:00.000Z"
}
```

### Paginated Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data retrieved successfully",
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  },
  "apiVersion": "v1",
  "timestamp": "2025-06-07T12:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed",
  "error": "Unprocessable Entity",
  "details": ["email must be a valid email address"],
  "apiVersion": "v1",
  "timestamp": "2025-06-07T12:00:00.000Z"
}
```

### App-Zone Responses — Whitelist DTOs (Secure by Default)

The default pipeline is _expose-everything-minus-`@Exclude()`_. That is fine for the trusted **admin** zone, but **app**-zone endpoints (USER subject) must send only the fields the client needs. Map the entity to a dedicated response DTO with whitelist semantics (see ADR-0006):

```typescript
// src/modules/user/dto/user-app-response.dto.ts
export class UserAppResponseDto {
  @Expose() id!: string;
  @Expose() fullName!: string;
  // ...only the fields the app needs. Everything else is dropped.
}

// in the app controller
return plainToInstance(UserAppResponseDto, user, {
  excludeExtraneousValues: true,
});
```

`excludeExtraneousValues: true` drops any property without `@Expose()`, so a column added to the entity later **never** leaks to the app surface unless explicitly added to the DTO. The resulting DTO instance still flows through `ClassSerializerInterceptor` and `ResponseInterceptor` unchanged.

### How to Use `ResponseUtil`

The `ResponseInterceptor` wraps return values automatically. But when you need manual control:

```typescript
import { ResponseUtil } from 'src/common/utils/response.util';

// In a service or when bypassing the interceptor
return ResponseUtil.success(data, 'Created successfully');
return ResponseUtil.paginated(items, total, page, limit);
return ResponseUtil.error('Something went wrong', 500);
```

---

## 8. Authentication & Authorization

### How JWT Works in This Project

```
Client sends: Authorization: Bearer <accessToken>
                                        │
                              JwtStrategy extracts payload:
                              {
                                sub: "uuid",
                                subjectType: "USER" | "ADMIN",
                                userId?: "uuid",
                                adminId?: "uuid",
                                roleId?: "uuid",
                                ...
                              }
                                        │
                              Attaches to request.user
```

### Getting the Current User in a Controller

```typescript
import { CurrentUser, AuthenticatedUser } from 'src/modules/auth/api';

@Get('profile')
getProfile(@CurrentUser() user: AuthenticatedUser) {
  return this.userService.findById(user.id);
}
```

### Making an Endpoint Public

```typescript
import { Public } from 'src/modules/auth/api';

@Get('status')
@Public()
getStatus() {
  return { status: 'ok' };
}
```

### Role-Based Access Control

Authorization decorators live in the **role** module. `RequireRoles` + `RolesGuard` are exposed on `src/modules/role`; `RequirePermissions` + `PermissionsGuard` + `PermissionModule` on `src/modules/role/api`. Neither guard is global — apply it with `@UseGuards(...)` (commonly at the controller class level), then annotate the handler.

```typescript
import { UseGuards } from '@nestjs/common';
import { RequireRoles, RolesGuard } from 'src/modules/role';
import { RequirePermissions, PermissionsGuard, PermissionModule } from 'src/modules/role/api';

// Coarse: only admins whose role is 'superadmin' or 'editor'
@UseGuards(RolesGuard)
@RequireRoles('superadmin', 'editor')
@Get()
findAll() { ... }

// Fine-grained: a specific permission on a module
@UseGuards(PermissionsGuard)
@RequirePermissions({
  module: PermissionModule.ADMIN,
  permission: 'create',
})
@Post()
create(@Body() dto: CreateAdminDto) { ... }
```

> Only `JwtAuthGuard` and `ThrottlerGuard` are registered globally (see [app.module.ts](src/app.module.ts)). `RolesGuard`, `PermissionsGuard`, `ResourceOwnershipGuard`, and `SubjectGuard` are opt-in per controller/handler via `@UseGuards()`.

### Dual Authentication — User vs Admin

The system has two distinct authenticated subjects. **Always check `subjectType`** when authorization depends on it.

| Property        | User                     | Admin                    |
| --------------- | ------------------------ | ------------------------ |
| `subjectType`   | `'USER'`                 | `'ADMIN'`                |
| Identifier      | `userId`                 | `adminId`                |
| Login method    | Phone + Password / OAuth | Email + Password (+ 2FA) |
| Has roles       | No                       | Yes                      |
| Has permissions | No                       | Yes                      |

### Restricting an Endpoint to a Subject Type — `@RequireSubject`

The global `JwtAuthGuard` only proves a token is valid — it does **not** distinguish USER from ADMIN. To restrict an endpoint to one subject type (e.g. the `app/` zone, which is USER-only), use `SubjectGuard` + `@RequireSubject` (symmetric with `PermissionsGuard` + `@RequirePermissions`):

```typescript
import {
  RequireSubject,
  SubjectGuard,
  CurrentUser,
  AuthenticatedUser,
} from 'src/modules/auth/api';

@Controller({ path: 'app/me', version: '1' })
@UseGuards(SubjectGuard)
@RequireSubject('USER') // an ADMIN token → 403 Forbidden
export class UserAppController {
  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.findOne(user.id); // target derived from the token, no :id param
  }
}
```

### User Registration State Machine

Users cannot log in until they reach `COMPLETED` state.

```
POST /auth/register/otp          → sends OTP to phone
        │
        ▼ (OTP verified)
POST /auth/register/otp/verify   → registrationStage = OTP_VERIFIED
        │
        ▼
POST /auth/register/password     → registrationStage = PASSWORD_SET
        │
        ▼
POST /auth/register/profile      → registrationStage = COMPLETED ✓
```

---

## 9. Database & Entity Standards

### Base Entity — Extend This Always

Every entity **must** extend `BaseEntity`. It is an **abstract** class (no `@Entity()` decorator — that belongs on the concrete entity), uses `timestamptz` columns, and indexes `deletedAt` so soft-delete filtering stays fast:

```typescript
// src/common/entities/base.entity.ts
export abstract class BaseEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'gen_random_uuid()',
  })
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Index()
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt?: Date; // Soft delete — never physically delete rows
}
```

For append-only tables that must **not** be soft-deletable (the log tables), extend `AuditEntity` instead (`src/common/entities/audit.entity.ts`) — same `id`/`createdAt`/`updatedAt`, but no `deletedAt`.

### Creating an Entity

```typescript
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;
}
```

### Entity Rules

| Rule                                                           | Reason                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| Always extend `BaseEntity`                                     | UUID PK, timestamps, soft delete included              |
| Use soft deletes only (`DeleteDateColumn`)                     | Data is auditable, recoverable                         |
| Name tables explicitly with snake_case `@Entity('table_name')` | Avoids TypeORM naming surprises                        |
| Use `nullable: true` explicitly when a column can be null      | TypeORM defaults vary                                  |
| Exclude sensitive fields with `@Exclude()`                     | `ClassSerializerInterceptor` strips them automatically |

```typescript
import { Exclude } from 'class-transformer';

@Column({ select: false })
@Exclude()
password: string;
```

### Unique Columns on Soft-Deletable Entities — Use Partial Unique Indexes

Because soft delete leaves the row in place, a plain `@Column({ unique: true })` would keep a deleted record's value reserved forever — re-using it (e.g. re-registering a deleted user's phone) fails with `duplicate key value violates unique constraint`. Scope uniqueness to **active** rows with a partial unique index instead of an unconditional unique constraint (see ADR-0007):

```typescript
@Entity('users')
@Index('UQ_users_phone_active', ['phone'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class User extends BaseEntity {
  @Column() // NOT @Column({ unique: true })
  phone!: string;
}
```

This lets deleted rows hold stale values while active rows stay unique. The existence pre-checks in services already ignore soft-deleted rows (TypeORM's default), so a reused value creates a fresh record.

### Migrations — Never Use `synchronize: true`

`synchronize: true` is **disabled** in production. Always generate migrations:

```bash
# After changing an entity — provide the output path (TypeORM v0.3 syntax):
npm run migration:generate src/infrastructure/database/migrations/AddProductTable

# Apply migrations:
npm run migration:run

# Revert last migration:
npm run migration:revert
```

---

## 10. Error Handling

### Exception Filters — Automatic, No Action Needed

All exceptions are caught automatically by the global exception filters. Processing order (most-specific first):

```
DatabaseExceptionFilter     ← PostgreSQL-level errors (duplicate, FK violation)
ThrottlerExceptionFilter    ← Rate limit exceeded (429)
HttpExceptionFilter         ← NestJS HttpException subclasses
AllExceptionsFilter         ← Catch-all for unexpected errors
```

### PostgreSQL Error Code Mapping

| PG Error Code | Meaning                     | HTTP Status              |
| ------------- | --------------------------- | ------------------------ |
| `23505`       | Unique constraint violation | 409 Conflict             |
| `23503`       | Foreign key violation       | 422 Unprocessable Entity |
| `23502`       | Not null violation          | 400 Bad Request          |
| `22P02`       | Invalid UUID format         | 400 Bad Request          |

### How to Throw Errors in Services

```typescript
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

async findById(id: string): Promise<Admin> {
  const admin = await this.adminRepository.findOne({ where: { id } });
  if (!admin) {
    throw new NotFoundException(`Admin with id "${id}" not found`);
  }
  return admin;
}

async create(dto: CreateAdminDto): Promise<Admin> {
  const exists = await this.adminRepository.findOne({ where: { email: dto.email } });
  if (exists) {
    throw new ConflictException('An admin with this email already exists');
  }
  return this.adminRepository.save(dto);
}
```

---

## 11. Logging & Observability

### Two Types of Logs

| Type            | Table           | Purpose                                              | Who writes it                     |
| --------------- | --------------- | ---------------------------------------------------- | --------------------------------- |
| **ActivityLog** | `activity_logs` | End-user actions (login, register, profile changes)  | Interceptor or `ActivityLogEvent` |
| **AuditLog**    | `audit_logs`    | Admin-driven changes with `oldValue`/`newValue` diff | Interceptor or `AuditLogEvent`    |

### Two Write Paths

There are two distinct ways to write a log entry. Choose based on when the user identity is known.

#### Path 1 — `@LogActivity` Interceptor (authenticated endpoints)

Use this for any endpoint protected by `JwtAuthGuard` where `request.user` is populated before the handler runs.

```typescript
import { LogAction, LogActivity } from 'src/modules/log/api';

@Patch('me')
@LogActivity({
  action: LogAction.UPDATE_PROFILE,
  description: 'Profile updated',
  resourceType: 'Auth',                              // optional
  getResourceId: (_, req) =>                         // optional
    (req as unknown as { user?: { id?: string } }).user?.id,
})
async updateProfile(@CurrentUser() user: AuthenticatedUser, ...) {
  return this.userAuthService.updateProfile(...);
}
```

The interceptor automatically logs `LogStatus.SUCCESS` on completion and `LogStatus.FAILURE` if the handler throws, then re-throws the error so exception filters still run normally.

#### Path 2 — Service Events (`@Public()` endpoints and failure cases)

`@Public()` endpoints run before authentication, so `request.user` is null and the interceptor skips logging. Domain services must emit events directly via `EventEmitter2`.

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
import { buildRequestContext } from 'src/common/utils/request-context.util';
import {
  ACTIVITY_LOG_EVENT,
  ActivityLogEvent,
  LogAction,
  LogStatus,
} from 'src/modules/log';

@Injectable()
export class UserAuthService {
  constructor(private eventEmitter: EventEmitter2) {}

  async userLogin(dto: UserLoginDto, request: Request) {
    const user = await this.validateUser(dto).catch((error) => {
      // Log failure before re-throwing
      this.eventEmitter.emit(
        ACTIVITY_LOG_EVENT,
        new ActivityLogEvent({
          userId: 'unknown',
          action: LogAction.LOGIN,
          description: 'User login failed',
          resourceType: 'Auth',
          status: LogStatus.FAILURE,
          ...buildRequestContext(request),
        }),
      );
      throw error;
    });

    // Log success
    this.eventEmitter.emit(
      ACTIVITY_LOG_EVENT,
      new ActivityLogEvent({
        userId: user.id,
        action: LogAction.LOGIN,
        description: 'User logged in',
        resourceType: 'Auth',
        resourceId: user.id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      }),
    );
  }
}
```

Use `AuditLogEvent` / `AUDIT_LOG_EVENT` for admin service events — same pattern.

### Audit Log Before/After Diffs

To capture what changed, use `diffAuditValues` + `attachAuditLogMetadata` in the service. The interceptor reads the metadata off the return value and writes the diff to the audit log.

```typescript
import {
  attachAuditLogMetadata,
  diffAuditValues,
} from 'src/modules/log/api';

async updateAdmin(id: string, dto: UpdateAdminDto): Promise<Admin> {
  const before = await this.findById(id);
  const updated = await this.adminRepository.save({ ...before, ...dto });

  const diff = diffAuditValues(before, updated, ['fullName', 'email', 'isActive']);
  return attachAuditLogMetadata(updated, diff);
  // Interceptor consumes the non-enumerable __auditLogMetadata property.
  // It never appears in the API response.
}
```

`diffAuditValues` automatically strips any field named `password` — no manual redaction needed.

### Log Retention

Both `ActivityLogService` and `AuditLogService` run a scheduled purge at 2 AM daily (configurable via `LOG_RETENTION_DAYS` in `src/common/utils/date-time.util.ts`). No manual setup required — the cron is registered via `@Cron('0 2 * * *')` on `purgeOldLogs()`.

### Winston Logging in Services

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  async create(dto: CreateProductDto) {
    this.logger.log(`Creating product: ${dto.name}`);
    try {
      const product = await this.productRepository.save(dto);
      this.logger.log(`Product created: ${product.id}`);
      return product;
    } catch (error) {
      this.logger.error('Failed to create product', error.stack);
      throw error;
    }
  }
}
```

---

## 12. File Uploads (AWS S3)

### Service: `FileUploadService`

Inject and use wherever file operations are needed:

```typescript
@Injectable()
export class ProductService {
  constructor(private readonly fileUploadService: FileUploadService) {}

  async uploadImage(productId: string, file: Express.Multer.File) {
    const key = await this.fileUploadService.upload(
      file,
      `products/${productId}`,
    );
    return key; // Store this key in the database, NOT the presigned URL
  }
}
```

### Auto-Converting Keys to Presigned URLs

Use `@ResolvePresignedUrls()` on controller methods to auto-convert S3 keys in the response:

```typescript
@Get(':id')
@ResolvePresignedUrls('imageKey', 'thumbnailKey')  // field names in the response
async findOne(@Param('id') id: string) {
  return this.productService.findById(id);
  // Response will have imageKey replaced with a presigned URL automatically
}
```

**Key rule:** Always store the S3 **key** (file path) in the database. Never store presigned URLs — they expire.

---

## 13. Async Notifications (BullMQ)

Emails and SMS are **never sent synchronously** during a request. They are queued (`EMAIL_NOTIFICATION_QUEUE`, `SMS_NOTIFICATION_QUEUE`) and processed by workers.

`NotificationService` exposes **purpose-specific** methods, not a generic `sendEmail`. The current methods are:

| Method                                 | Channel | Behaviour                                                |
| -------------------------------------- | ------- | -------------------------------------------------------- |
| `sendTwoFactorCode(payload)`           | Email   | Fire-and-forget (queued, returns `void`)                 |
| `sendForgotPasswordResetCode(payload)` | Email   | Fire-and-forget (queued, returns `void`)                 |
| `sendSmsOtp(payload)`                  | SMS     | Awaits the worker result → `{ success, requestId }`      |
| `verifySmsOtp(payload)`                | SMS     | Awaits the worker result → `{ success, verifiedAt, to }` |

```typescript
@Injectable()
export class TwoFactorService {
  constructor(private readonly notificationService: NotificationService) {}

  async challenge(admin: Admin, code: string) {
    // Fire-and-forget: queued asynchronously, request is not blocked on delivery
    await this.notificationService.sendTwoFactorCode({
      email: admin.email,
      name: admin.fullName,
      code,
    });
  }
}
```

When adding a new email type, add a method here plus a job handler in `EmailProcessor` — do not call Nodemailer from a request handler.

### How It Works

```
Service calls notificationService.sendTwoFactorCode()
        │
        ▼
Job added to EMAIL_NOTIFICATION_QUEUE (Redis/BullMQ)
        │
        ▼ (async, non-blocking)
EmailProcessor picks up the job (by job name)
        │
        ▼
Nodemailer sends the email
```

SMS works the same way via `SMS_NOTIFICATION_QUEUE` and `SmsProcessor`, except `sendSmsOtp`/`verifySmsOtp` await the job result because the caller needs the provider `requestId`/verification outcome.

### Event-Driven Notifications

Some notifications fire indirectly through domain events instead of a direct `NotificationService` call. The forgot-password flow is the reference example:

1. The auth service emits `ForgotPasswordCodeRequestedEvent` (`FORGOT_PASSWORD_CODE_REQUESTED`, exported from `src/modules/auth`).
2. `ForgotPasswordCodeListener` (`src/infrastructure/notification/listeners/`) subscribes and calls `notificationService.sendForgotPasswordResetCode()`, queuing the email.

This keeps the auth module decoupled from notification infrastructure — auth emits, infrastructure reacts.

---

## 14. Validation Standards

### DTO Structure

```typescript
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { PartialType, PickType } from '@nestjs/mapped-types';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProductCategory)
  category: ProductCategory;
}

// Update DTO — all fields optional automatically
export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

### Pagination DTO — Always Extend This

```typescript
import { PaginationFilterDto } from 'src/common/dto/pagination-filter.dto';

export class FilterProductDto extends PaginationFilterDto {
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @IsOptional()
  @IsString()
  search?: string;
}
```

`PaginationFilterDto` provides: `page` (default 1), `limit` (default 10), and `getAll` (default false — return all rows, bypassing pagination). Do not redefine these. Add resource-specific filters like `search` in the subclass.

### Global String Trimming

A global `TrimPipe` runs **before** `ValidationPipe` on every request. It recursively trims leading and trailing whitespace from all string values in request bodies and query parameters.

**Behavior:**

| Input type               | Behavior                                        |
| ------------------------ | ----------------------------------------------- |
| `body` / `query` strings | Trimmed (e.g. `"  hello  "` → `"hello"`)        |
| Nested object fields     | Trimmed recursively                             |
| Array items              | Each string element trimmed                     |
| Route `@Param()`         | **Not trimmed** — URL params are never modified |
| Non-string values        | Passed through unchanged                        |

No action needed — this is global and automatic. Validators run on already-trimmed values, so `@MinLength(3)` on `"  ab  "` correctly fails (the trimmed value `"ab"` has length 2).

```typescript
// src/common/pipes/trim.pipe.ts — applied globally in main.ts
app.useGlobalPipes(
  new TrimPipe(), // runs first
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

### Global Validation Pipe Settings

The global `ValidationPipe` is configured with:

- `whitelist: true` — strips unknown fields automatically
- `forbidNonWhitelisted: true` — throws error on unknown fields
- `transform: true` — auto-converts `"1"` to `1`, `"true"` to `true`

No action needed — this is automatic.

---

## 15. Transaction Management

Use `@Transactional()` for operations that must succeed or fail together. The decorated class **must** expose a `dataSource` property (inject it with `@InjectDataSource()`) — the decorator reads `this.dataSource` and throws at call time if it's missing. Propagation is REQUIRED: a nested `@Transactional()` call reuses the active transaction rather than opening a new one.

```typescript
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Transactional } from 'src/common/transaction/transactional.decorator';

@Injectable()
export class OrderService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Transactional()
  async placeOrder(dto: PlaceOrderDto): Promise<Order> {
    // All queries in this method run in a single DB transaction
    const order = await this.orderRepository.save({ ...dto });
    await this.inventoryService.deductStock(dto.productId, dto.quantity);
    await this.paymentService.charge(dto.paymentDetails);
    // If any line throws, ALL changes are rolled back automatically
    return order;
  }
}
```

**When to use `@Transactional()`:**

- Creating multiple related records
- Updating one record based on another
- Any operation where partial failure would corrupt data

---

## 16. Key Decorators Reference

### Auth Decorators

| Decorator                            | Import From            | Effect                                                                           |
| ------------------------------------ | ---------------------- | -------------------------------------------------------------------------------- |
| `@Public()`                          | `src/modules/auth/api` | Bypasses JWT authentication                                                      |
| `@CurrentUser()`                     | `src/modules/auth/api` | Injects current authenticated user                                               |
| `@RequireSubject('USER' \| 'ADMIN')` | `src/modules/auth/api` | Asserts `subjectType` (needs `@UseGuards(SubjectGuard)`)                         |
| `@CheckOwnership()`                  | `src/modules/auth`     | Verifies resource belongs to caller (needs `@UseGuards(ResourceOwnershipGuard)`) |
| `@RequireRoles('admin', 'editor')`   | `src/modules/role`     | Restricts by role name (needs `@UseGuards(RolesGuard)`)                          |
| `@RequirePermissions({...})`         | `src/modules/role/api` | Restricts by specific permission (needs `@UseGuards(PermissionsGuard)`)          |

### Logging Decorators

| Decorator                                                              | Import From           | Effect                                                                                                                                                             |
| ---------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@LogActivity({ action, description, resourceType?, getResourceId? })` | `src/modules/log/api` | Records user action to activity log on success **and** failure. Only works on authenticated (non-`@Public()`) endpoints — use service events for public endpoints. |

### Common Decorators

| Decorator                          | Import From                                       | Effect                                    |
| ---------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| `@RequestTimeout(ms)`              | `src/common/decorators/request-timeout.decorator` | Overrides 10s global request timeout      |
| `@ResolvePresignedUrls(...fields)` | `src/common/decorators/presigned-urls.decorator`  | Auto-converts S3 keys to URLs in response |

---

## 17. Environment Variables

Copy `.env.example` to `.env` and fill in all values. The Joi schema in [env.validation.ts](src/common/config/env.validation.ts) is the source of truth — it runs with `allowUnknown: true`, so vars not listed there (e.g. `REDIS_PREFIX_KEY`) are read directly via `ConfigService` and are not validated. Variables marked **required** below abort startup if missing.

```bash
# App
NODE_ENV=development             # development | production | test (default: development)
PORT=3000                        # default 3000
APP_NAME=nest-forge              # default "NestJS TypeORM API Starter"
# Note: TZ is forced to 'UTC' in src/main.ts — it is NOT read from the environment.

# Database (DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME are REQUIRED)
DB_HOST=localhost
DB_PORT=5432                     # default 5432
DB_USERNAME=postgres
DB_PASSWORD=secret
DB_NAME=nest_forge

# Auth
AUTH_PASSWORD_SALT_ROUNDS=10     # bcrypt cost factor (default 10)

# JWT (JWT_SECRET, JWT_REFRESH_SECRET REQUIRED — must be 32+ chars)
JWT_SECRET=your-very-long-secret-here
JWT_REFRESH_SECRET=another-very-long-secret-here
JWT_EXPIRATION=900000            # 15 minutes in ms (default)
JWT_REFRESH_EXPIRATION=2592000000  # 30 days in ms (default)

# Redis
REDIS_HOST=localhost             # default localhost
REDIS_PORT=6379                  # default 6379
REDIS_PREFIX_KEY=nest_forge:     # BullMQ/cache key prefix (read directly, not validated)

# CORS (comma-separated origins, or '*'/'all'/'true' for all — dev only)
CORS_ORIGINS=http://localhost:3000

# Email (SMTP_FROM_NAME is REQUIRED)
SMTP_FROM_NAME=nest-forge

# AWS S3 (all optional — only needed when file uploads are used)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-southeast-1
AWS_BUCKET_NAME=my-project-bucket
AWS_ENDPOINT=                    # optional custom endpoint (e.g. S3-compatible storage)

# OAuth (optional)
GOOGLE_CLIENT_ID=...
APPLE_CLIENT_ID=...

# OTP / SMS
OTP_MOCK_ENABLED=true            # skip real SMS in dev
OTP_MOCK_CODE=000000             # 6-digit mock code (default 000000)
SMS_MOCK_ENABLED=false           # default false
# SMS provider (Poh) — all optional, required only when sending real SMS:
SMS_POH_API_KEY=...
SMS_POH_API_SECRET_KEY=...
SMS_POH_BASE_API_URL=...
SMS_POH_API_BRAND=...
SMS_POH_API_SENDER_ID=...
```

---

## 18. Database Migrations & Seeding

### The `forge` CLI

The project ships a purpose-built CLI at `cli/` that wraps all database operations under a single `forge db` command tree. It is registered as a local binary in `package.json`:

```json
"bin": { "forge": "./cli/index.ts" }
```

Run it directly with `npx forge` or install locally:

```bash
npx ts-node cli/index.ts db --help
```

**Why use `forge` instead of raw `npm run` scripts?**

|                       | `forge` CLI                                           | `npm run migration:*`                   |
| --------------------- | ----------------------------------------------------- | --------------------------------------- |
| Migration output path | Enforced to `src/infrastructure/database/migrations/` | Must be typed manually (full path)      |
| Naming                | Just pass the name: `AddProductTable`                 | Full path required                      |
| Discoverability       | `forge db --help` lists all sub-commands              | Must read `package.json`                |
| Seeding               | `forge db seed / clear / reset`                       | `npm run db:seed / db:clear / db:reset` |

### `forge db` Command Tree

```
forge db
├── migrate
│   ├── generate <name>   Generate a migration into src/infrastructure/database/migrations/
│   ├── run               Apply all pending migrations
│   └── revert            Revert the last applied migration
├── seed                  Run all seeders
├── clear                 Delete all data
└── reset                 clear + seed in sequence
```

### Migration Commands

```bash
# Generate a new migration — just provide the name, path is enforced automatically
npx ts-node -r tsconfig-paths/register cli/index.ts db migrate generate AddProductTable
# Creates: src/infrastructure/database/migrations/<timestamp>-AddProductTable.ts

# Apply all pending migrations
npx ts-node -r tsconfig-paths/register cli/index.ts db migrate run

# Revert the last applied migration
npx ts-node -r tsconfig-paths/register cli/index.ts db migrate revert
```

Equivalent `npm run` aliases (for quick use in development):

```bash
npm run migration:generate src/infrastructure/database/migrations/AddProductTable
npm run migration:run
npm run migration:revert

# Production (compiled JS):
npm run migration:run:prod
npm run migration:revert:prod
```

> **Tip:** Always review the generated migration file before running it. TypeORM infers the schema diff but can emit unexpected `DROP COLUMN` statements when column options change.

### Seeding Commands

```bash
# Seed the database (creates roles, permissions, superadmin, settings)
npx ts-node -r tsconfig-paths/register cli/index.ts db seed

# Clear all data
npx ts-node -r tsconfig-paths/register cli/index.ts db clear

# Reset = clear + seed (sequential, exits on clear failure)
npx ts-node -r tsconfig-paths/register cli/index.ts db reset
```

Equivalent `npm run` aliases:

```bash
npm run db:seed
npm run db:clear
npm run db:reset
```

**Seeding creates:**

- Default roles: `superadmin`, `admin`, `editor`, `viewer`
- All permissions for all modules
- Superadmin account (credentials from env vars)
- Default application settings

---

## 19. Best Practices & Rules

### Architecture Rules (Non-Negotiable)

1. **Never put business logic in a controller.** Controllers call services and return.
2. **Never access another module's repository directly.** Use that module's exported service.
3. **Use the right barrel — no deep imports.** Controllers import from `api.ts`. Domain services import services from `api.ts` and entities/events from `index.ts`. No symbol appears in both barrels.
4. **Always extend `BaseEntity`.** No entity without UUID, timestamps, and soft delete.
5. **Never use `synchronize: true`** in TypeORM config. Always write migrations.
6. **Never store presigned URLs in the database.** Store the S3 key only.
7. **Never send emails/SMS synchronously.** Always queue them via `NotificationService`.
8. **Always validate environment variables.** Add new vars to the Joi schema in `env.validation.ts`.
9. **Respect module boundaries — they're linted.** `no-restricted-imports` and `import-x/no-cycle` in `eslint.config.mjs` enforce barrel imports and reject circular dependencies. Run `npm run lint`.

### Code Quality Rules

```typescript
// ✅ Use readonly for injected dependencies
constructor(private readonly userService: UserService) {}

// ✅ Use explicit return types on service methods
async findAll(filter: FilterUserDto): Promise<[User[], number]> { ... }

// ✅ Use PartialType for update DTOs
export class UpdateUserDto extends PartialType(CreateUserDto) {}

// ✅ Use @Exclude() on sensitive entity fields
@Column()
@Exclude()
password: string;

// ✅ Always log with context
private readonly logger = new Logger(UserService.name);

// ❌ Never use console.log
console.log('something happened');  // Use this.logger.log() instead

// ❌ Never catch errors silently
try {
  await something();
} catch (e) {
  // silent catch — this hides bugs
}
```

### Security Rules

1. Hash passwords with bcryptjs — use `PasswordHashUtil`, never roll your own
2. Never log passwords, tokens, or secrets
3. Always validate and sanitize input — DTOs with class-validator handle this
4. Use parameterized queries — TypeORM repository methods are safe by default
5. Rate limiting is global — add stricter limits on auth endpoints with `@Throttle()`

---

## 20. Common Mistakes to Avoid

| Mistake                                                                  | Correct Approach                                                                                                 |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Using `@LogActivity` on a `@Public()` endpoint                           | `@Public()` endpoints have no `request.user` — emit `ActivityLogEvent`/`AuditLogEvent` from the service instead  |
| Controller importing from `index.ts`                                     | `index.ts` has no services or DTOs — controllers must use `api.ts`                                               |
| Domain service importing an entity or event from `api.ts`                | Entities and events live in `index.ts` — `api.ts` has no entities                                                |
| Domain service importing a service from `index.ts`                       | Services live in `api.ts` — use `import { FooService } from 'src/modules/foo/api'`                               |
| Re-exporting the same symbol in both barrels                             | Each symbol has exactly one home: services/DTOs/decorators → `api.ts`; module class/entities/events → `index.ts` |
| Importing deep into a module (`src/modules/auth/services/token.service`) | Import from the correct barrel: `api.ts` for services/DTOs, `index.ts` for entities/events                       |
| Injecting `UserRepository` in `AuthService`                              | Call `UserService.findByPhone()` instead                                                                         |
| Calling `synchronize: true` in TypeORM config                            | Generate and run migrations                                                                                      |
| Storing presigned S3 URLs in the database                                | Store the S3 key; resolve URLs at response time                                                                  |
| Sending emails inside a request handler                                  | Queue via `NotificationService`                                                                                  |
| Throwing raw `Error` objects                                             | Throw NestJS `HttpException` subclasses                                                                          |
| Using `console.log` for debugging                                        | Use `Logger` from `@nestjs/common`                                                                               |
| Forgetting `@Exclude()` on password fields                               | Always add `@Exclude()` to sensitive columns                                                                     |
| Writing business logic in a controller                                   | Move all logic to the service                                                                                    |
| Creating entities without extending `BaseEntity`                         | Always extend `BaseEntity`                                                                                       |
| Creating a circular import between modules                               | Restructure so dependencies flow one way; `import-x/no-cycle` blocks it. Move shared logic up or into `common/`  |

---

## 21. Adding a New Module — Step-by-Step

Follow this checklist when creating a new domain module (example: `product`).

### Step 1 — Create the Directory Structure

```bash
mkdir -p src/modules/product/{dto,entities,services}
touch src/modules/product/product.module.ts
touch src/modules/product/index.ts
touch src/modules/product/api.ts
```

### Step 2 — Create the Entity

```typescript
// src/modules/product/entities/product.entity.ts
import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;
}
```

### Step 3 — Create DTOs

```typescript
// src/modules/product/dto/create-product.dto.ts
import { IsString, IsNumber, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;
}
```

```typescript
// src/modules/product/dto/update-product.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

### Step 4 — Create the Service

```typescript
// src/modules/product/services/product.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Product } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(dto);
    return this.productRepository.save(product);
  }

  async findAll(): Promise<Product[]> {
    // No deletedAt clause needed — @DeleteDateColumn makes TypeORM exclude
    // soft-deleted rows automatically. Use { withDeleted: true } to include them.
    return this.productRepository.find();
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);
    return this.productRepository.save({ ...product, ...dto });
  }

  async remove(id: string): Promise<void> {
    const product = await this.findById(id);
    await this.productRepository.softRemove(product);
  }
}
```

### Step 5 — Create the Module

```typescript
// src/modules/product/product.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductService } from './services/product.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
```

### Step 6 — Create the Two Barrel Files

**`index.ts`** — module wiring and domain types only (no services, no DTOs):

```typescript
// src/modules/product/index.ts
export { ProductModule } from './product.module'; // for app.module.ts imports
export { Product } from './entities/product.entity'; // entity type for other domain services
// No ProductService — services live in api.ts
// No DTOs — DTOs live in api.ts
```

**`api.ts`** — services, DTOs, and route decorators only (no module class, no entities):

```typescript
// src/modules/product/api.ts
export { ProductService } from './services/product.service';
export { CreateProductDto } from './dto/create-product.dto';
export { UpdateProductDto } from './dto/update-product.dto';
export { FilterProductDto } from './dto/filter-product.dto';
// No ProductModule — controllers don't register modules
// No Product entity — raw entities never cross the HTTP boundary
```

### Step 7 — Create the Controller

```typescript
// src/api/v1/admin/product/product.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ProductService,
  CreateProductDto,
  UpdateProductDto,
} from 'src/modules/product/api';
import { RequireRoles, RolesGuard } from 'src/modules/role';

@Controller({ path: 'admin/products', version: '1' }) // → /api/v1/admin/products
@UseGuards(RolesGuard) // guard applied once at class level
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll() {
    return this.productService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Post()
  @RequireRoles('superadmin', 'editor')
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Put(':id')
  @RequireRoles('superadmin', 'editor')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @RequireRoles('superadmin')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
```

Place admin-facing controllers under `src/api/v1/admin/<resource>/` and end-user ones under `src/api/v1/app/<resource>/` (see §4). The global prefix `api` and URI versioning produce the final `/api/v1/...` path from the `version` in `@Controller`.

### Step 8 — Register in AppModule

```typescript
// src/app.module.ts
import { ProductModule } from 'src/modules/product';

@Module({
  imports: [
    // ... existing modules
    ProductModule,
  ],
})
export class AppModule {}
```

**Where does the controller get registered?** Not in `app.module.ts` — its `controllers` array holds only `AppController`. The convention is one of:

- **Register the controller in its domain module** — e.g. `AdminModule`, `UserModule`, and `SettingModule` each declare their controller in their own `@Module({ controllers: [...] })`. Simplest for single-controller resources.
- **Create a dedicated `*ApiModule`** under `src/api/v1/...` that imports the domain module and declares the controllers — used by `RoleApiModule` (role + permissions controllers) and `AppApiModule` (the `app/` zone). That `*ApiModule` is then imported by `app.module.ts`.

Pick the API-module pattern when a zone has multiple controllers or needs audience-specific wiring; otherwise register the controller in the domain module.

### Step 9 — Generate and Run the Migration

```bash
# Using the forge CLI (recommended — path is enforced automatically):
npx ts-node -r tsconfig-paths/register cli/index.ts db migrate generate CreateProductsTable
npx ts-node -r tsconfig-paths/register cli/index.ts db migrate run

# Or via npm run aliases:
npm run migration:generate src/infrastructure/database/migrations/CreateProductsTable
npm run migration:run
```

### Step 10 — Verify

```bash
npm run start:dev
# Test endpoints at http://localhost:3000/api/v1/products
```

---

## Quick Reference Card

```
Adding a module?        Follow the 10-step checklist in Section 21.
New endpoint?           Controller calls service. Zero logic in controller.
Writing a controller?   Import services/DTOs/decorators from api.ts only.
Need another service?   Import it from api.ts — services live there, not index.ts.
Need an entity/event?   Import from index.ts — entities and events live there.
DB change?              Edit entity → forge db migrate generate <Name> → forge db migrate run.
Send email/SMS?         Queue it via NotificationService. Never send inline.
File upload?            Store S3 key in DB. Use @ResolvePresignedUrls on GET.
Need a transaction?     Annotate the service method with @Transactional().
Public endpoint?        Add @Public() decorator.
Role restriction?       @UseGuards(RolesGuard) + @RequireRoles(...), or @UseGuards(PermissionsGuard) + @RequirePermissions(...).
Seed / reset DB?        forge db seed | forge db reset.
Something broken?       Check logs/ directory. All errors are structured there.
```

---

_This document reflects the architecture of nest-forge v3.x. When in doubt, read the existing code — it is the source of truth._
