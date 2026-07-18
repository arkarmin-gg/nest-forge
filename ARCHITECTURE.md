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
18. [Security Standards](#18-security-standards)
19. [Database Migrations & Seeding](#19-database-migrations--seeding)
20. [Best Practices & Rules](#20-best-practices--rules)
21. [Common Mistakes to Avoid](#21-common-mistakes-to-avoid)
22. [Adding a New Module — Step-by-Step](#22-adding-a-new-module--step-by-step)
23. [Quality Gates](#23-quality-gates)

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
│   │   │   ├── constants/           # Reflector metadata keys, event names (one per file)
│   │   │   ├── decorators/
│   │   │   ├── dto/
│   │   │   ├── entities/
│   │   │   ├── enums/               # SubjectType, ...
│   │   │   ├── events/
│   │   │   ├── guards/
│   │   │   ├── interfaces/
│   │   │   ├── seeders/
│   │   │   ├── services/
│   │   │   ├── strategies/
│   │   │   ├── auth.module.ts
│   │   │   └── index.ts             # Domain public barrel — module wiring/types
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
│   │   ├── config/                  # Env validation, logger config, upload (Multer) config
│   │   ├── decorators/              # @RequestTimeout, @ResolvePresignedUrls
│   │   ├── dto/                     # PaginationFilterDto, SortableFilterDto
│   │   ├── entities/                # BaseEntity, SoftDeletableEntity
│   │   ├── filters/                 # Exception filters
│   │   ├── interceptors/            # Response, Timeout, PresignedUrl
│   │   ├── interfaces/              # ApiResponse<T>
│   │   ├── middleware/              # RequestId middleware
│   │   ├── pipes/                   # TrimPipe (global string trimming)
│   │   ├── services/                # S3ClientService, EmailService, FcmService, SMSPohService, FileUploadService, StartupService
│   │   ├── utils/                   # Stateless helpers — date/time, hash, password, request-context, response, S3 URL parsing
│   │   └── validators/              # Custom validators (password)
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
async create(
  @Body() dto: CreateAdminDto,
  @CurrentUser() admin: AuthenticatedUser,
  @Req() request: Request,
) {
  return this.adminService.create(dto, admin.id, request);
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
- An end-user endpoint goes under `api/v1/app/<resource>/`, route prefix `app/...`, gated by `SubjectGuard` + `@RequireSubject(SubjectType.USER)`. It **must** map to a whitelist response DTO (see §7) and derive the target from `@CurrentUser()` — never a `:id` path param.
- Domain services in `modules/` stay audience-agnostic and are reused by both zones; the audience-specific shaping lives in the controller.

Reference example: `src/api/v1/app/user/user-app.controller.ts` (`GET`/`PATCH /api/v1/app/me`).

### Zone 2: `modules/` — Domain Layer

**Responsibility:** All business logic. This is where your application's value lives.

Each module contains:

- `entities/` — TypeORM entities (the data model)
- `dto/` — Data Transfer Objects for input validation
- `services/` — Business logic
- `events/` — Domain events for cross-module communication
- `enums/` — TS enums, one per file (see below)
- `interfaces/` — Exported, reusable domain interfaces, one per file (see below)
- `constants/` — Exported primitive constants — Reflector metadata keys, event-name strings, config values — one per file (see below)
- `index.ts` — Module wiring and domain types (module class, entities, events)
- `public-api.ts` — Callable public application surface: services, DTOs, and route decorators (no re-exports of `index.ts` symbols)

**Rules:**

- A module **only accesses its own entities**
- To use another module's data, call that module's **exported service**
- Always expose both `index.ts` and `public-api.ts` barrels — no symbol appears in both
- Controllers always import from `public-api.ts` — services, DTOs, and route decorators live there
- Domain services import services from `public-api.ts`; entities and events from `index.ts`
- Barrels are architectural boundary contracts only, never convenience aggregators

#### `enums/`, `interfaces/`, `constants/` — One Concern Per Folder

A module keeps its enums, its reusable interfaces, and its primitive constants in three separate folders — never mixed into a single catch-all `constants/` (see ADR-0011). Each folder holds one symbol per file, named after the symbol:

```
modules/log/
├── enums/
│   ├── log-action.enum.ts
│   ├── log-status.enum.ts
│   └── log-job-name.enum.ts
├── interfaces/
│   ├── create-activity-log.interface.ts
│   └── create-audit-log.interface.ts
└── constants/
    └── log-queue.constants.ts
```

**What goes where:**

- `enums/*.enum.ts` — TS `enum` declarations, including the varchar-backed enums from §9 (e.g. `OtpStatus`, `LogAction`). Also the natural home for a decorator's parameter type when that parameter is a fixed set of string values (e.g. `SubjectType` for `@RequireSubject()`) — prefer an enum over a union type alias so it's importable, validated with `@IsEnum()`, and discoverable in one place.
- `interfaces/*.interface.ts` — **exported** interfaces meant to be imported elsewhere (a guard, a DTO, another service). A file-private, non-exported interface that shapes a single function's options or a seeder's local config (e.g. `RoleConfig` in `role.seeder.ts`) stays right where it's declared — moving it would only be relocation for its own sake, since nothing outside that file could ever import it.
- `constants/*.constant.ts` — exported primitive constants: `SetMetadata` Reflector keys (`PERMISSIONS_KEY`), queue names (`LOG_QUEUE`, `EMAIL_NOTIFICATION_QUEUE`), and standalone config values (job retry counts, backoff delays). Even though a constant is only ever read by one queue registration, it still gets its own file here rather than staying inline — this keeps the "what enums/interfaces/constants does this module define" question answerable by listing three folders, not by reading every service and processor file.

**Barrels:** none of these three folders gets its own `index.ts`. Import by direct file path (`from '../enums/log-status.enum'`) — the module-root `index.ts`/`public-api.ts` remains the only real barrel boundary (per the two-barrel rule above). A module only gets the folders it needs — no empty `enums/` in a module with no enums.

### Zone 3: `infrastructure/` — Technical Layer

**Responsibility:** Database migrations, health checks, message queues. No business logic.

### Zone 4: `common/` — Shared Layer

**Responsibility:** Reusable technical utilities shared across all modules.

Includes: filters, interceptors, base entities, shared DTOs, utility functions.

**Conventions:**

- Every subfolder exports through its own `index.ts` barrel. Import from the barrel (`src/common/utils`), never from a file inside it — this keeps future renames/moves inside `common/` a one-line barrel change instead of a repo-wide find/replace.
- Do not add a single `src/common/index.ts` mega-barrel. Keep imports scoped to the relevant common subfolder.
- Common subfolder barrels follow the same hygiene rules as module barrels: named exports only, `export type` for types, and no side effects.
- `utils/` holds stateless pure functions only, named `*.util.ts` (e.g. `date-time.util.ts`, `s3-url.util.ts`).
- `services/` holds `@Injectable()` classes, named `*.service.ts` (e.g. `s3-client.service.ts`, `email.service.ts`). If it has external dependencies (DB, S3, SMTP, external APIs) or DI-injected state, it's a service, not a util.
- Config objects/schemas (Multer options, env validation, logger setup) go in `config/`, named `*.config.ts`.

---

## 5. Module Structure — The Golden Template

Every new domain module **must** follow this exact structure:

```
modules/
└── article/                         ← Your new module
    ├── dto/
    │   ├── create-article.dto.ts
    │   ├── update-article.dto.ts
    │   └── filter-article.dto.ts
    ├── entities/
    │   └── article.entity.ts
    ├── services/
    │   └── article.service.ts
    ├── article.module.ts
    ├── index.ts                     ← Domain public API (module wiring/types)
    └── public-api.ts                       ← Callable public application surface
```

### `index.ts` vs `public-api.ts` — Two Barrels, Two Audiences

Every module exposes two barrel files with a **strict no-overlap rule**: if a symbol is in `public-api.ts` it must not appear in `index.ts`, and vice versa. Each symbol has exactly one canonical home. These barrels are architectural boundary contracts, not shortcuts for avoiding relative paths inside a module (see ADR-0013).

|                   | `index.ts`                                                                  | `public-api.ts`                                                                       |
| ----------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Used by**       | Other domain modules, `app.module.ts`                                       | Controllers in `src/api/v1/`; domain services calling another module's public service |
| **Exports**       | Module class, entities, events, domain interfaces, guards used as providers | Services, DTOs, decorators for routes, controller-facing types                        |
| **Never exports** | DTOs, route decorators, route guards                                        | Module class, entities, events, internal interfaces                                   |

**`index.ts` — Module wiring and domain types**

```typescript
// modules/article/index.ts
export { ArticleModule } from './article.module'; // ← module class, for app.module.ts
export { Article } from './entities/article.entity'; // ← entity, for domain services that need the type
export { ArticleCreatedEvent } from './events/article-created.event'; // ← events
// No ArticleService — services live in public-api.ts
// No DTOs — DTOs live in public-api.ts
```

**`public-api.ts` — Services, DTOs, and route decorators**

```typescript
// modules/article/public-api.ts
export { ArticleService } from './services/article.service'; // ← service, for both controllers and domain services
export { CreateArticleDto } from './dto/create-article.dto';
export { UpdateArticleDto } from './dto/update-article.dto';
export { FilterArticleDto } from './dto/filter-article.dto';
// No ArticleModule — controllers don't register modules
// No Article entity — controllers never handle raw entities
// No events — domain services import those from index.ts
```

**Import rules:**

```typescript
// ✅ Controller importing — always use public-api.ts
// src/api/v1/article/article.controller.ts
import {
  ArticleService,
  CreateArticleDto,
} from 'src/modules/article/public-api';

// ✅ Domain service calling another module's service — use public-api.ts (services live there)
// src/modules/workflow/services/workflow.service.ts
import { ArticleService } from 'src/modules/article/public-api';

// ✅ Own-module code uses relative direct imports — never its own barrel
// src/modules/article/services/article.service.ts
import { Article } from '../entities/article.entity';
import { CreateArticleDto } from '../dto/create-article.dto';

// ✅ Domain service needing an entity type or event — use index.ts
// src/modules/workflow/services/workflow.service.ts
import { Article } from 'src/modules/article';
import { ArticleCreatedEvent } from 'src/modules/article';

// ❌ WRONG — deep import bypasses module boundary
import { ArticleService } from 'src/modules/article/services/article.service';

// ❌ WRONG — controller importing from index.ts (no services or DTOs there)
import { Article, ArticleModule } from 'src/modules/article';

// ❌ WRONG — importing a service from index.ts (it no longer lives there)
import { ArticleService } from 'src/modules/article';
```

The no-overlap rule means every symbol has exactly one canonical import path. There is no need to guess which barrel to check.

### Barrel Hygiene Rules

Barrels must stay boring. They are public export manifests only:

```typescript
// ✅ CORRECT — named, side-effect-free, type-only where possible
export { ArticleService } from './services/article.service';
export { CreateArticleDto } from './dto/create-article.dto';
export type { ArticleListItem } from './interfaces/article-list-item.interface';

// ❌ WRONG — wildcard exports leak internals and hide API growth
export * from './services/article.service';

// ❌ WRONG — barrels never run code
initializeArticleMetadata();
```

Rules:

- No `export *` from `index.ts`, `public-api.ts`, or `common/*/index.ts`
- Use `export type` for type-only exports
- No runtime initialization, logging, metadata setup, or other side effects
- Code inside a module imports its own files with relative direct paths, not `src/modules/<same-module>` or `src/modules/<same-module>/public-api`
- Controllers import from `public-api.ts` only; if a controller needs a decorator/type, that symbol belongs in `public-api.ts`
- Domain services may import another module's service from `public-api.ts`, but should not reuse HTTP DTOs unless that DTO is intentionally a cross-module service contract
- Entity relation files (`*.entity.ts`) may direct-import other entity files for TypeORM relationship wiring
- Seeder, data-source, and migration code may direct-import concrete entities and seeder classes as low-level database code

### Automated Enforcement (ESLint)

These boundaries are enforced mechanically by `eslint.config.mjs`, so `npm run lint` fails on a violation:

- **`no-restricted-imports`** blocks deep imports into a module's internals (e.g. `src/modules/auth/services/token.service`) — you must import through the `index.ts` / `public-api.ts` barrel. `*.entity.ts` files are exempt, since TypeORM relations legitimately reach across module internals.
- **`import-x/no-cycle`** (error) rejects circular import dependencies between files. Entity files are exempt because bidirectional TypeORM relations (e.g. `User` ↔ `RefreshToken`) form intentional, lazily-resolved cycles.

Follow-up mechanical checks should also reject wildcard barrel exports, own-module self-imports through root barrels, and overlap between `index.ts` and `public-api.ts`.

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
> - Interceptors are spread across files: `ClassSerializerInterceptor` + `TimeoutInterceptor` in `main.ts`; `PresignedUrlInterceptor` + `ResponseInterceptor` as `APP_INTERCEPTOR` in [common.module.ts](src/common/common.module.ts). There is no global activity-log interceptor — log writes are explicit `LogQueueService` calls inside service methods (§11), not something that runs on every request. NestJS runs interceptors' pre-controller logic in registration order and their post-controller (response) logic in reverse, so on the way out `ResponseInterceptor` wraps first, then presigned-URL resolution, etc.

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
import { ResponseUtil } from 'src/common/utils';

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
import { CurrentUser, AuthenticatedUser } from 'src/modules/auth/public-api';

@Get('profile')
getProfile(@CurrentUser() user: AuthenticatedUser) {
  return this.userService.findById(user.id);
}
```

### Making an Endpoint Public

```typescript
import { Public } from 'src/modules/auth/public-api';

@Get('status')
@Public()
getStatus() {
  return { status: 'ok' };
}
```

### Role-Based Access Control

Authorization decorators live in the **role** module. `RequireRoles` + `RolesGuard` are exposed on `src/modules/role`; `RequirePermissions` + `PermissionsGuard` + `PermissionModule` on `src/modules/role/public-api`. Neither guard is global — apply it with `@UseGuards(...)` (commonly at the controller class level), then annotate the handler.

```typescript
import { UseGuards } from '@nestjs/common';
import { RequireRoles, RolesGuard } from 'src/modules/role';
import { RequirePermissions, PermissionsGuard, PermissionModule } from 'src/modules/role/public-api';

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

| Property        | User                     | Admin            |
| --------------- | ------------------------ | ---------------- |
| `subjectType`   | `'USER'`                 | `'ADMIN'`        |
| Identifier      | `userId`                 | `adminId`        |
| Login method    | Phone + Password / OAuth | Email + Password |
| Has roles       | No                       | Yes              |
| Has permissions | No                       | Yes              |

### Restricting an Endpoint to a Subject Type — `@RequireSubject`

The global `JwtAuthGuard` only proves a token is valid — it does **not** distinguish USER from ADMIN. To restrict an endpoint to one subject type (e.g. the `app/` zone, which is USER-only), use `SubjectGuard` + `@RequireSubject` (symmetric with `PermissionsGuard` + `@RequirePermissions`):

```typescript
import {
  RequireSubject,
  SubjectGuard,
  CurrentUser,
  AuthenticatedUser,
} from 'src/modules/auth/public-api';

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

Detailed database and TypeORM rules live in
[docs/database-standards.md](docs/database-standards.md). Treat that file as
the canonical implementation checklist for entities, repositories, relations,
transactions, migrations, and seeds.

Summary:

- Normal mutable domain records extend `SoftDeletableEntity`; lifecycle records
  extend `BaseEntity`; raw entity shapes require a documented exception.
- Modules own their repositories. Cross-module data access goes through the
  owning module's exported service.
- Schema changes go through migrations generated under
  `src/infrastructure/database/migrations/`.
- `npx forge db ...` is the sanctioned database command surface.

Key decisions: ADR-0007 covers partial unique indexes for soft delete,
ADR-0008 covers transaction management, ADR-0009 covers enum-like columns, and
ADR-0012 covers the `forge` CLI.

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

| Type            | Table           | Purpose                                              | Who writes it     |
| --------------- | --------------- | ---------------------------------------------------- | ----------------- |
| **ActivityLog** | `activity_logs` | End-user actions (login, register, profile changes)  | `LogQueueService` |
| **AuditLog**    | `audit_logs`    | Admin-driven changes with `oldValue`/`newValue` diff | `LogQueueService` |

There is no interceptor and no `@LogActivity` decorator. Every log write is an explicit call from inside the service method that performs the underlying business operation — never inferred from route metadata, and never triggered from the controller layer.

### Write Path — Direct Enqueue via `LogQueueService`

`src/modules/log` registers a dedicated BullMQ queue (`LOG_QUEUE`) with a single `LogProcessor` that persists jobs to the appropriate table. Services call `LogQueueService` directly — there is **no `EventEmitter2` hop** for logs. This is a deliberate departure from the notification module's event-bridge pattern (§13): logs have exactly one producer-to-consumer relationship per call site, so the event-emitter indirection would add nothing. Use the event-bridge pattern when something else might need to subscribe to the same signal; use direct-enqueue when the queue is the only consumer, as it is here.

```typescript
import { buildRequestContext } from 'src/common/utils';
import {
  LogAction,
  LogQueueService,
  LogStatus,
} from 'src/modules/log/public-api';

@Injectable()
export class AdminService {
  constructor(private readonly logQueueService: LogQueueService) {}

  async update(
    id: string,
    dto: UpdateAdminDto,
    adminId: string,
    request: Request,
  ) {
    try {
      // ... perform the update ...

      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.UPDATE,
        description: 'Admin updated another admin',
        entityName: 'Admin',
        entityId: id,
        status: LogStatus.SUCCESS,
        ...buildRequestContext(request),
      });
    } catch (error) {
      await this.logQueueService.enqueueAuditLog({
        adminId,
        action: LogAction.UPDATE,
        description: 'Admin update failed',
        entityName: 'Admin',
        status: LogStatus.FAILURE,
        ...buildRequestContext(request),
      });
      throw error;
    }
  }
}
```

Use `enqueueActivityLog` for end-user actions and `enqueueAuditLog` for admin-driven ones — the call site always knows which table applies. Where a single method serves both an admin-zone and an app-zone caller (e.g. `UserService.update`, shared by an admin editing another user and a user editing their own profile), the caller passes an `actor` describing who made the request, and the method branches explicitly between the two `enqueue*` calls — the branching stays in application code, not inside `LogQueueService`.

`LogQueueService` swallows its own enqueue failures (logs via `Logger.error`, never throws) — a Redis outage must never fail the business operation that already succeeded. Jobs run with the same retry policy as email jobs (`attempts: 3`, exponential backoff, `removeOnComplete: true`, `removeOnFail: { count: 100 }`).

### Success/Failure Semantics

- **Non-transactional methods** (the large majority): "success" means the method resolved without throwing. Enqueue the `SUCCESS` log immediately after the write; enqueue a `FAILURE` log (in a `catch` block, then re-throw) if anything before that point throws.
- **Transactional methods** (only `RoleService.create`/`update` today, via `@Transactional()`): the enqueue must happen only after the transaction actually commits, since a later statement in the same transaction could still roll back everything. Because `@nestjs-cls/transactional` (this project's installed version) does not expose a commit-hook API, the pattern is to split the method into a private `@Transactional()`-decorated core (e.g. `createInTransaction`) and a public, non-transactional wrapper that awaits the core and enqueues afterward. The wrapper's `await` only resolves once the decorator's wrapped promise has resolved — which is only after commit — so this achieves the same guarantee without a hook:

```typescript
async create(dto: CreateRoleDto, adminId: string, request: Request) {
  try {
    const role = await this.createInTransaction(dto); // resolves only after commit
    await this.logQueueService.enqueueAuditLog({ /* SUCCESS */ });
    return role;
  } catch (error) {
    await this.logQueueService.enqueueAuditLog({ /* FAILURE */ });
    throw error;
  }
}

@Transactional()
private async createInTransaction(dto: CreateRoleDto) {
  /* ... the actual transactional writes ... */
}
```

Failure logs are never gated on this — they're emitted immediately at the point of failure, since there's no commit to wait on either way.

### Audit Log Before/After Diffs

`diffAuditValues` is a pure function — it returns a plain `{ oldValue, newValue }` object, nothing more. Pass the result straight into the `enqueueAuditLog` call.

```typescript
import { diffAuditValues } from 'src/modules/log/public-api';

async updateAdmin(id: string, dto: UpdateAdminDto, adminId: string, request: Request) {
  const before = await this.findById(id);
  const updated = await this.adminRepository.save({ ...before, ...dto });

  const { oldValue, newValue } = diffAuditValues(before, updated, ['fullName', 'email', 'isActive']);

  await this.logQueueService.enqueueAuditLog({
    adminId,
    action: LogAction.UPDATE,
    entityName: 'Admin',
    entityId: id,
    description: 'Admin updated another admin',
    oldValue,
    newValue,
    status: LogStatus.SUCCESS,
    ...buildRequestContext(request),
  });

  return updated;
}
```

`diffAuditValues` automatically redacts sensitive fields such as passwords,
tokens, OTPs, API keys, provider secrets, authorization headers, cookies, and
close variants — no manual redaction needed. `CreateActivityLogData` (activity
logs) has no `oldValue`/`newValue` fields — diffs are an audit-log-only
concept.

### Log Retention

Both `ActivityLogService` and `AuditLogService` run a scheduled purge at 2 AM daily (configurable via `LOG_RETENTION_DAYS` in `src/common/utils/date-time.util.ts`). No manual setup required — the cron is registered via `@Cron('0 2 * * *')` on `purgeOldLogs()`.

### Winston Logging in Services

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class ArticleService {
  private readonly logger = new Logger(ArticleService.name);

  async create(dto: CreateArticleDto) {
    this.logger.log(`Creating article: ${dto.name}`);
    try {
      const article = await this.articleRepository.save(dto);
      this.logger.log(`Article created: ${article.id}`);
      return article;
    } catch (error) {
      this.logger.error('Failed to create article', error.stack);
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
export class ArticleService {
  constructor(private readonly fileUploadService: FileUploadService) {}

  async uploadImage(articleId: string, file: Express.Multer.File) {
    const key = await this.fileUploadService.upload(
      file,
      `articles/${articleId}`,
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
  return this.articleService.findById(id);
  // Response will have imageKey replaced with a presigned URL automatically
}
```

**Key rule:** Always store the S3 **key** (file path) in the database. Never store presigned URLs — they expire.

---

## 13. Async Notifications (BullMQ)

Emails are **never sent synchronously** during a request. They are queued (`EMAIL_NOTIFICATION_QUEUE`) and processed by a worker. SMS OTP is a deliberate, narrow exception — see below.

`NotificationService` exposes **purpose-specific** methods, not a generic `sendEmail`. The current methods are:

| Method                                 | Channel | Behaviour                                |
| -------------------------------------- | ------- | ---------------------------------------- |
| `sendForgotPasswordResetCode(payload)` | Email   | Fire-and-forget (queued, returns `void`) |

When adding a new email type, add a method here plus a job handler in `EmailProcessor` — do not call Nodemailer from a request handler.

### How It Works

```
Service calls notificationService.sendForgotPasswordResetCode()
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

### SMS OTP — A Deliberate Exception

SMS is **not** queued through `NotificationService`/BullMQ — there is no `SMS_NOTIFICATION_QUEUE`
or `SmsProcessor`. `UserAuthService` and `PasswordResetService` inject `SMSPohService`
(`src/common/services/sms-poh.service.ts`) directly and call it synchronously in the request path:

```typescript
@Injectable()
export class UserAuthService {
  constructor(private readonly smsPohService: SMSPohService) {}

  async userRegisterOTPRequest(dto: UserRegisterOTPRequestDto) {
    const { success, requestId } = await this.smsPohService.sendOTP({
      to: dto.phone,
      message: '...',
    });
    // requestId is needed immediately to correlate the later verify call
  }

  async userRegisterOTPVerify(dto: UserRegisterOTPVerifyDto) {
    await this.smsPohService.verifyOTP({
      requestId: dto.requestId,
      code: dto.otp,
    });
  }
}
```

This is intentional: OTP send/verify are request/response operations the caller needs an
immediate result from (`{ success, requestId }` on send, a thrown exception or success on verify)
— not fire-and-forget notifications. Treat it like calling any other external API (comparable to
an S3 or payment-gateway call), not as a queued notification.

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

export class CreateArticleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ArticleCategory)
  category: ArticleCategory;
}

// Update DTO — all fields optional automatically
export class UpdateArticleDto extends PartialType(CreateArticleDto) {}
```

### Pagination, Filtering, and Sorting

List endpoint rules live in
[docs/pagination-filtering-sorting.md](docs/pagination-filtering-sorting.md).
ADR-0010 records the sorting decision (`SortableFilterDto` +
`resolveSortField`).

Short version:

- Paginated list DTOs extend `PaginationFilterDto`.
- Sortable list DTOs extend `SortableFilterDto`.
- Services allowlist client-controlled sort fields before calling `.orderBy()`.
- Resource-specific filters such as `search`, `isBanned`, `startDate`, and
  `endDate` live on the resource filter DTO.

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

See [docs/database-standards.md](docs/database-standards.md#transactions)
for the canonical transaction checklist.

Transactions are powered by [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional) with the TypeORM adapter (registered globally in `app.module.ts`). Use `@Transactional()` for operations that must succeed or fail together. Inside a transactional method, **all** database access must go through `this.txHost.tx` — the transaction-aware `EntityManager` from the injected `TransactionHost`. Outside a transaction, `txHost.tx` transparently falls back to the default manager, so the same code works in non-transactional methods too. Propagation is REQUIRED by default: a nested `@Transactional()` call reuses the active transaction rather than opening a new one.

Use a transaction when partial success would corrupt domain state. If a side
effect must happen only after commit, split the method into a private
transactional core and a public wrapper that awaits it before enqueuing the
side effect. See §11 for the log-specific version of that pattern and
ADR-0008 for the decision record.

---

## 16. Key Decorators Reference

### Auth Decorators

| Decorator                            | Import From                   | Effect                                                                           |
| ------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------- |
| `@Public()`                          | `src/modules/auth/public-api` | Bypasses JWT authentication                                                      |
| `@CurrentUser()`                     | `src/modules/auth/public-api` | Injects current authenticated user                                               |
| `@RequireSubject('USER' \| 'ADMIN')` | `src/modules/auth/public-api` | Asserts `subjectType` (needs `@UseGuards(SubjectGuard)`)                         |
| `@CheckOwnership()`                  | `src/modules/auth`            | Verifies resource belongs to caller (needs `@UseGuards(ResourceOwnershipGuard)`) |
| `@RequireRoles('admin', 'editor')`   | `src/modules/role`            | Restricts by role name (needs `@UseGuards(RolesGuard)`)                          |
| `@RequirePermissions({...})`         | `src/modules/role/public-api` | Restricts by specific permission (needs `@UseGuards(PermissionsGuard)`)          |

### Logging

There is no logging decorator. Activity/audit logs are written by calling `LogQueueService.enqueueActivityLog(...)` / `enqueueAuditLog(...)` directly from the service method performing the write — see §11.

### Common Decorators

| Decorator                          | Import From                                       | Effect                                    |
| ---------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| `@RequestTimeout(ms)`              | `src/common/decorators/request-timeout.decorator` | Overrides 10s global request timeout      |
| `@ResolvePresignedUrls(...fields)` | `src/common/decorators/presigned-urls.decorator`  | Auto-converts S3 keys to URLs in response |

---

## 17. Environment Variables

Copy `.env.example` to `.env` and fill in all values. The Joi schema in
[env.validation.ts](src/common/config/env.validation.ts) is the source of
truth, and ADR-0014 records the configuration policy.

Environment variables are a strict application contract:

- Every app env var must be declared in the Joi schema, represented in
  `.env.example`, and documented here.
- Unknown variables in the env-file contract abort Nest app startup. Normal shell
  variables such as `PATH` are not part of that strict check.
- Runtime code should consume namespaced config keys from `registerAs()` config
  objects, e.g. `jwt.secret`, `redis.host`, and `seed.superAdmin.email`.
- Do not read raw `process.env` or raw uppercase env keys in application code.
  Exceptions are config factories, bootstrap/tooling boundaries, and code paths
  that cannot receive injected config.
- Time-based env names must include their unit.
- Provider credentials are grouped behind explicit toggles. Disabled providers
  may have blank credentials; enabled providers must have complete credentials.

```bash
# App
NODE_ENV=development             # development | production | test (default: development)
PORT=3000                        # default 3000
APP_NAME=nest-forge              # default "nest-forge"
# Note: TZ is forced to 'UTC' in src/main.ts — it is NOT read from the environment.

# Database (DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME are REQUIRED)
DB_HOST=localhost
DB_PORT=5432                     # default 5432
DB_USERNAME=postgres
DB_PASSWORD=secret
DB_NAME=nest_forge

# Auth
AUTH_PASSWORD_SALT_ROUNDS=10     # bcrypt cost factor (default 10)

# JWT (secrets REQUIRED — must be 32+ chars and not placeholders)
JWT_SECRET=your-very-long-secret-here
JWT_REFRESH_SECRET=another-very-long-secret-here
JWT_ACCESS_TOKEN_TTL_SECONDS=900       # 15 minutes (default)
JWT_REFRESH_TOKEN_TTL_SECONDS=2592000  # 30 days (default)

# Redis
REDIS_HOST=localhost             # default localhost
REDIS_PORT=6379                  # default 6379
REDIS_PREFIX_KEY=nest-forge      # BullMQ/cache key prefix (default "nest-forge")

# CORS (comma-separated origins, or '*'/'all'/'true' for all — dev only)
CORS_ORIGINS=http://localhost:3000

# Seed defaults (all required except SEED_SMTP_PASSWORD)
SEED_SUPER_ADMIN_EMAIL=admin@example.com
SEED_SUPER_ADMIN_PASSWORD=your-strong-local-password
SEED_SMTP_FROM_NAME=nest-forge
SEED_SMTP_USERNAME=noreply@example.com
SEED_SMTP_PASSWORD=

# AWS S3 (credentials required only when S3_ENABLED=true)
S3_ENABLED=false
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-southeast-1
AWS_BUCKET_NAME=my-project-bucket
AWS_ENDPOINT=                    # optional custom endpoint (e.g. S3-compatible storage)

# OTP / SMS
OTP_MOCK_ENABLED=true            # skip real SMS in dev
OTP_MOCK_CODE=000000             # 6-digit mock code (default 000000)
SMS_MOCK_ENABLED=true            # default true
SMS_POH_ENABLED=false            # credentials required when true and SMS_MOCK_ENABLED=false
SMS_POH_API_KEY=...
SMS_POH_API_SECRET_KEY=...
SMS_POH_BASE_API_URL=...
SMS_POH_API_BRAND=...
SMS_POH_API_SENDER_ID=...
```

---

## 18. Security Standards

Detailed security rules live in
[docs/security-standards.md](docs/security-standards.md). Treat that file as
the canonical implementation checklist for route authorization, sensitive data
exposure, secrets/configuration, input safety, logging redaction, throttling,
error disclosure, and operational security.

The short version:

- Routes are authenticated by default. `@Public()` is an explicit opt-out and
  needs a narrow pre-auth reason.
- Admin endpoints use permission guards; app endpoints use subject guards and
  derive the target from `@CurrentUser()`.
- Sensitive fields use both `select: false` and `@Exclude()`.
- App-zone responses use whitelist DTOs with `@Expose()`.
- Secrets never have production defaults and never appear in logs, responses,
  audit diffs, migrations, or seed data.
- Public auth/provider endpoints need stricter route-level throttles than the
  global baseline.

## 19. Database Migrations & Seeding

See [docs/database-standards.md](docs/database-standards.md#migrations) for
the canonical migration and seeding checklist.

> **Note:** This template ships a single baseline migration,
> `src/infrastructure/database/migrations/1784213162334-init.ts`, which creates
> the current foundation schema in one pass — `synchronize` is `false`. Run
> `npx forge db migrate run` to apply it, then generate further migrations as
> entities evolve. Known schema-hardening drift, including missing enum and
> ownership `CHECK` constraints, is documented in
> [docs/database-standards.md#known-drift](docs/database-standards.md#known-drift).

### The `forge` CLI

The project ships a purpose-built CLI at `cli/` that wraps **all** database
operations under a single `forge db` command tree. It is the sole sanctioned
way to touch the database — there is no parallel `npm run migration:*` or
`npm run db:*` path, and no raw `npm run typeorm` escape hatch.

```bash
npx forge db --help
```

Use the CLI to generate migrations, apply/revert/status migrations, seed,
clear, and reset databases. Production database commands run against the
compiled build, and destructive production commands require confirmation.
See [ADR-0012](docs/adr/0012-forge-cli-as-primary-database-tool.md) for the
rationale and [docs/database-standards.md](docs/database-standards.md) for the
full command reference.

```bash
npx forge db migrate generate AddArticleTable
npx forge db migrate run
npx forge db seed
```

---

## 20. Best Practices & Rules

This document owns the architectural shape of the system: the four zones,
module boundaries, request lifecycle, module template, and quality gates. The
detailed implementation checklists live in dedicated standards docs:

- Database, TypeORM, relations, migrations, seeds, and transactions:
  [docs/database-standards.md](docs/database-standards.md).
- Route authorization, sensitive data, secrets, input safety, logging
  redaction, and abuse controls:
  [docs/security-standards.md](docs/security-standards.md).
- Pagination, filtering, and sorting:
  [docs/pagination-filtering-sorting.md](docs/pagination-filtering-sorting.md).
- Review rules and mechanical checks:
  [docs/review/ARCHITECTURE-COMPLIANCE.md](docs/review/ARCHITECTURE-COMPLIANCE.md).

The non-negotiable architectural habits remain:

1. Controllers are thin and contain no business logic.
2. Domain modules own their entities and repositories.
3. Cross-module access goes through exported services, not foreign
   repositories.
4. Controllers and services use the correct module barrels.
5. Database changes go through migrations and the `forge` CLI.
6. Security controls are designed into the endpoint, not patched on at the end.
7. Async side effects use the queue/event patterns documented in this file.
8. Mechanical checks run before a change is considered ready.

---

## 21. Common Mistakes to Avoid

| Mistake                                                                  | Correct Approach                                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Writing audit/activity logs synchronously from a controller              | Call `LogQueueService.enqueueActivityLog()`/`enqueueAuditLog()` from the service, only after the write succeeds         |
| Controller importing from `index.ts`                                     | `index.ts` has no services or DTOs — controllers must use `public-api.ts`                                               |
| Domain service importing an entity or event from `public-api.ts`         | Entities and events live in `index.ts` — `public-api.ts` has no entities                                                |
| Domain service importing a service from `index.ts`                       | Services live in `public-api.ts` — use `import { FooService } from 'src/modules/foo/public-api'`                        |
| Re-exporting the same symbol in both barrels                             | Each symbol has exactly one home: services/DTOs/decorators → `public-api.ts`; module class/entities/events → `index.ts` |
| Importing deep into a module (`src/modules/auth/services/token.service`) | Import from the correct barrel: `public-api.ts` for services/DTOs, `index.ts` for entities/events                       |
| Using wildcard exports in a barrel (`export * from ...`)                 | Use named exports only so public API growth is explicit                                                                 |
| Importing a module's own barrel from inside that same module             | Use relative direct imports (`../entities/user.entity`) to avoid self-cycles                                            |
| Adding nested domain barrels (`dto/index.ts`, `services/index.ts`)       | Only module-root `index.ts`/`public-api.ts` are domain boundary barrels                                                 |
| Injecting `UserRepository` in `AuthService`                              | Call `UserService.findByPhone()` instead                                                                                |
| Calling `synchronize: true` in TypeORM config                            | Generate and run migrations                                                                                             |
| Storing presigned S3 URLs in the database                                | Store the S3 key; resolve URLs at response time                                                                         |
| Sending emails inside a request handler                                  | Queue via `NotificationService`                                                                                         |
| Throwing raw `Error` objects                                             | Throw NestJS `HttpException` subclasses                                                                                 |
| Using `console.log` for debugging                                        | Use `Logger` from `@nestjs/common`                                                                                      |
| Forgetting `@Exclude()` on password fields                               | Always add `@Exclude()` to sensitive columns                                                                            |
| Writing business logic in a controller                                   | Move all logic to the service                                                                                           |
| Creating normal mutable entities without `SoftDeletableEntity`           | Use `SoftDeletableEntity`; reserve `BaseEntity`/raw entities for documented lifecycle, log, or join-table exceptions    |
| Creating a circular import between modules                               | Restructure so dependencies flow one way; `import-x/no-cycle` blocks it. Move shared logic up or into `common/`         |

---

## 22. Adding a New Module — Step-by-Step

Follow this checklist when creating a new domain module (example: `article`).

### Step 1 — Create the Directory Structure

```bash
mkdir -p src/modules/article/{dto,entities,services}
touch src/modules/article/article.module.ts
touch src/modules/article/index.ts
touch src/modules/article/public-api.ts
```

### Step 2 — Create the Entity

```typescript
// src/modules/article/entities/article.entity.ts
import { SoftDeletableEntity } from 'src/common/entities';
import { Column, Entity } from 'typeorm';

@Entity('articles')
export class Article extends SoftDeletableEntity {
  @Column({ length: 255 })
  name!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price!: number;
}
```

### Step 3 — Create DTOs

```typescript
// src/modules/article/dto/create-article.dto.ts
import { IsString, IsNumber, Min } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;
}
```

```typescript
// src/modules/article/dto/update-article.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateArticleDto } from './create-article.dto';

export class UpdateArticleDto extends PartialType(CreateArticleDto) {}
```

### Step 4 — Create the Service

```typescript
// src/modules/article/services/article.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Article } from '../entities/article.entity';
import { CreateArticleDto } from '../dto/create-article.dto';
import { UpdateArticleDto } from '../dto/update-article.dto';

@Injectable()
export class ArticleService {
  private readonly logger = new Logger(ArticleService.name);

  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
  ) {}

  async create(dto: CreateArticleDto): Promise<Article> {
    const article = this.articleRepository.create(dto);
    return this.articleRepository.save(article);
  }

  async findAll(): Promise<Article[]> {
    // No deletedAt clause needed — @DeleteDateColumn makes TypeORM exclude
    // soft-deleted rows automatically. Use { withDeleted: true } to include them.
    return this.articleRepository.find();
  }

  async findById(id: string): Promise<Article> {
    const article = await this.articleRepository.findOne({ where: { id } });
    if (!article) throw new NotFoundException(`Article ${id} not found`);
    return article;
  }

  async update(id: string, dto: UpdateArticleDto): Promise<Article> {
    const article = await this.findById(id);
    return this.articleRepository.save({ ...article, ...dto });
  }

  async remove(id: string): Promise<void> {
    const article = await this.findById(id);
    await this.articleRepository.softRemove(article);
  }
}
```

### Step 5 — Create the Module

```typescript
// src/modules/article/article.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './entities/article.entity';
import { ArticleService } from './services/article.service';

@Module({
  imports: [TypeOrmModule.forFeature([Article])],
  providers: [ArticleService],
  exports: [ArticleService],
})
export class ArticleModule {}
```

### Step 6 — Create the Two Barrel Files

**`index.ts`** — module wiring and domain types only (no services, no DTOs):

```typescript
// src/modules/article/index.ts
export { ArticleModule } from './article.module'; // for app.module.ts imports
export { Article } from './entities/article.entity'; // entity type for other domain services
// No ArticleService — services live in public-api.ts
// No DTOs — DTOs live in public-api.ts
```

**`public-api.ts`** — services, DTOs, and route decorators only (no module class, no entities):

```typescript
// src/modules/article/public-api.ts
export { ArticleService } from './services/article.service';
export { CreateArticleDto } from './dto/create-article.dto';
export { UpdateArticleDto } from './dto/update-article.dto';
export { FilterArticleDto } from './dto/filter-article.dto';
// No ArticleModule — controllers don't register modules
// No Article entity — raw entities never cross the HTTP boundary
```

### Step 7 — Create the Controller

```typescript
// src/api/v1/admin/article/article.controller.ts
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
  ArticleService,
  CreateArticleDto,
  UpdateArticleDto,
} from 'src/modules/article/public-api';
import { RequireRoles, RolesGuard } from 'src/modules/role';

@Controller({ path: 'admin/articles', version: '1' }) // → /api/v1/admin/articles
@UseGuards(RolesGuard) // guard applied once at class level
export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  @Get()
  findAll() {
    return this.articleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.articleService.findById(id);
  }

  @Post()
  @RequireRoles('superadmin', 'editor')
  create(@Body() dto: CreateArticleDto) {
    return this.articleService.create(dto);
  }

  @Put(':id')
  @RequireRoles('superadmin', 'editor')
  update(@Param('id') id: string, @Body() dto: UpdateArticleDto) {
    return this.articleService.update(id, dto);
  }

  @Delete(':id')
  @RequireRoles('superadmin')
  remove(@Param('id') id: string) {
    return this.articleService.remove(id);
  }
}
```

Place admin-facing controllers under `src/api/v1/admin/<resource>/` and end-user ones under `src/api/v1/app/<resource>/` (see §4). The global prefix `api` and URI versioning produce the final `/api/v1/...` path from the `version` in `@Controller`.

### Step 8 — Register in AppModule

```typescript
// src/app.module.ts
import { ArticleModule } from 'src/modules/article';

@Module({
  imports: [
    // ... existing modules
    ArticleModule,
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
# Using the forge CLI — path is enforced automatically:
npx forge db migrate generate CreateArticlesTable
npx forge db migrate run
```

### Step 10 — Verify

```bash
npm run start:dev
# Test endpoints at http://localhost:3000/api/v1/articles
```

---

## 23. Quality Gates

Two independent checkpoints enforce code health — one local (fast, staged-files-only), one in CI (full project, every PR).

### Pre-commit (`.husky/pre-commit`) — runs on every commit

```
npx lint-staged   # Prettier --write + ESLint --fix, staged src/**/*.ts and test/**/*.ts only (.lintstagedrc)
npm run build     # Nest production build must compile
npm run knip      # Unused files, exports, and dependencies — full project (knip.json), not just staged files
```

`knip.json` defines the project's entry points (`src/main.ts`, `src/data-source.ts`, migrations, tests) and scans `src/**/*.ts`, `cli/**/*.ts`, `test/**/*.ts` for anything unreachable from them.

### CI (`.github/workflows/ci.yml`) — runs on every PR and push to `main`, in order

1. `npm run lint:check` — ESLint, **no** `--fix`: a violation fails the build instead of silently patching it.
2. `npm run typecheck` — `tsc --noEmit`: the whole project must compile with zero type errors.
3. `npm test` — Jest unit tests when present.
4. `npm run build` — the Nest build must succeed.

### Rules

- Never bypass these with `--no-verify` or by disabling a script — fix the underlying issue instead.
- Run `npm run typecheck` and `npm run build` locally before pushing; don't rely on CI to be the first place a compile error surfaces.
- **Handling a knip false positive:** first check whether the file/export is genuinely dead — if so, delete it; don't suppress the finding. Only add an entry to `knip.json`'s ignore config when the symbol is a deliberately-kept public API surface knip can't infer (e.g. exported for an external consumer, referenced dynamically) — and leave a one-line comment at the ignore entry explaining why, so it doesn't read as stale later.

These gates run alongside the module-boundary linting already described in §5 (Automated Enforcement) and the migration discipline in §9 — this section is about _what runs and when_, not a restatement of those rules.

---

## Quick Reference Card

```
Adding a module?        Follow the 10-step checklist in Section 22.
New endpoint?           Controller calls service. Zero logic in controller.
Writing a controller?   Import services/DTOs/decorators from public-api.ts only.
Need another service?   Import it from public-api.ts — services live there, not index.ts.
Need an entity/event?   Import from index.ts — entities and events live there.
DB change?              Edit entity → forge db migrate generate <Name> → forge db migrate run.
Send email/SMS?         Queue it via NotificationService. Never send inline.
File upload?            Store S3 key in DB. Use @ResolvePresignedUrls on GET.
Need a transaction?     Annotate with @Transactional(); access the DB via this.txHost.tx.
Public endpoint?        Add @Public() decorator.
Role restriction?       @UseGuards(RolesGuard) + @RequireRoles(...), or @UseGuards(PermissionsGuard) + @RequirePermissions(...).
Seed / reset DB?        forge db seed | forge db reset.
Something broken?       Check logs/ directory. All errors are structured there.
```

---

_This document reflects the architecture of nest-forge v3.x. When in doubt, read the existing code — it is the source of truth._
