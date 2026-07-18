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
22. [Quality Gates](#22-quality-gates)

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

|                   | `index.ts`                                                                  | `public-api.ts`                                            |
| ----------------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| **Used by**       | Other domain modules, `app.module.ts`                                       | Controllers in `src/api/v1/`; domain services calling another module's public service |
| **Exports**       | Module class, entities, events, domain interfaces, guards used as providers | Services, DTOs, decorators for routes, controller-facing types |
| **Never exports** | DTOs, route decorators, route guards                                        | Module class, entities, events, internal interfaces |

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
import { ArticleService, CreateArticleDto } from 'src/modules/article/public-api';

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

| Property        | User                     | Admin                    |
| --------------- | ------------------------ | ------------------------ |
| `subjectType`   | `'USER'`                 | `'ADMIN'`                |
| Identifier      | `userId`                 | `adminId`                |
| Login method    | Phone + Password / OAuth | Email + Password         |
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

### Base Entity — Extend This Always

Every entity **must** extend `BaseEntity`. It is an **abstract** class (no `@Entity()` decorator — that belongs on the concrete entity), uses `timestamptz` columns, and indexes `deletedAt` so soft-delete filtering stays fast:

```typescript
// src/common/entities/base.entity.ts
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
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

For append-only tables that must **not** be soft-deletable (the log tables), extend `BaseEntity` instead (`src/common/entities/base.entity.ts`) — same `id`/`createdAt`/`updatedAt`, but no `deletedAt`.

### Creating an Entity

```typescript
import { BaseEntity } from 'src/common/entities';

@Entity('articles')
export class Article extends BaseEntity {
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

### Enum-Like Columns — `varchar` + `CHECK`, Never Native `enum`

**Never** declare an enum-like column as a native database enum (`@Column({ type: 'enum', enum: X })`). Always use `varchar`, typed in TypeScript by an `enum`/`const ... as const` object, backed by a migration `CHECK` constraint (see ADR-0009). A native DB enum makes adding/renaming a value an awkward `ALTER TYPE` migration and creates a second source of truth that can drift from the TS enum.

```typescript
// src/modules/otp/enums/otp-status.enum.ts — the source of truth
export enum OtpStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  USED = 'USED',
}

// DTO — validates against the same enum
export class FilterOtpDto {
  @IsOptional()
  @IsEnum(OtpStatus)
  status?: OtpStatus;
}

// entity — varchar, typed by the enum, NOT type: 'enum'
@Column({ type: 'varchar', default: OtpStatus.PENDING })
status!: OtpStatus;

// migration — CHECK mirrors the enum's values exactly
await queryRunner.query(
  `ALTER TABLE "otp_records" ADD CONSTRAINT "CK_otp_records_status" CHECK ("status" IN ('PENDING', 'VERIFIED', 'EXPIRED', 'USED'))`,
);
```

Size the `varchar` length to comfortably fit the longest current value — there is no fixed universal width. Adding or renaming a value means updating the TS enum **and** writing a migration that drops and re-adds the `CHECK` constraint with the new value list, in the same PR.

### Migrations — Never Use `synchronize: true`

`synchronize: true` is **disabled** in production. Always generate migrations:

```bash
# After changing an entity — provide the output path (TypeORM v0.3 syntax):
npm run migration:generate src/infrastructure/database/migrations/AddArticleTable

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

| Type            | Table           | Purpose                                              | Who writes it        |
| --------------- | --------------- | ----------------------------------------------------- | --------------------- |
| **ActivityLog** | `activity_logs` | End-user actions (login, register, profile changes)   | `LogQueueService`      |
| **AuditLog**    | `audit_logs`    | Admin-driven changes with `oldValue`/`newValue` diff   | `LogQueueService`      |

There is no interceptor and no `@LogActivity` decorator. Every log write is an explicit call from inside the service method that performs the underlying business operation — never inferred from route metadata, and never triggered from the controller layer.

### Write Path — Direct Enqueue via `LogQueueService`

`src/modules/log` registers a dedicated BullMQ queue (`LOG_QUEUE`) with a single `LogProcessor` that persists jobs to the appropriate table. Services call `LogQueueService` directly — there is **no `EventEmitter2` hop** for logs. This is a deliberate departure from the notification module's event-bridge pattern (§13): logs have exactly one producer-to-consumer relationship per call site, so the event-emitter indirection would add nothing. Use the event-bridge pattern when something else might need to subscribe to the same signal; use direct-enqueue when the queue is the only consumer, as it is here.

```typescript
import { buildRequestContext } from 'src/common/utils';
import { LogAction, LogQueueService, LogStatus } from 'src/modules/log/public-api';

@Injectable()
export class AdminService {
  constructor(private readonly logQueueService: LogQueueService) {}

  async update(id: string, dto: UpdateAdminDto, adminId: string, request: Request) {
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

`diffAuditValues` automatically strips any field named `password` — no manual redaction needed. `CreateActivityLogData` (activity logs) has no `oldValue`/`newValue` fields — diffs are an audit-log-only concept.

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
| --------------------------------------- | ------- | ------------------------------------------ |
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

For the full list-endpoint convention — accepted query params, currently
sortable resources, and the recipe for adding sortable fields — see
[docs/pagination-filtering-sorting.md](docs/pagination-filtering-sorting.md).
ADR-0010 records the sorting decision (`SortableFilterDto` +
`resolveSortField`).

### Pagination DTO — Always Extend This

```typescript
import { PaginationFilterDto } from 'src/common/dto';

export class FilterArticleDto extends PaginationFilterDto {
  @IsOptional()
  @IsEnum(ArticleCategory)
  category?: ArticleCategory;

  @IsOptional()
  @IsString()
  search?: string;
}
```

`PaginationFilterDto` provides: `page` (default 1), `limit` (default 10), and `getAll` (default false — return all rows, bypassing pagination). Do not redefine these. Add resource-specific filters like `search` in the subclass.

### Sortable Filter DTO — Use an Allowlist

Resources that support client-controlled sorting extend `SortableFilterDto`
instead of `PaginationFilterDto` directly:

```typescript
import { SortableFilterDto } from 'src/common/dto';

export class FilterArticleDto extends SortableFilterDto {
  @IsOptional()
  @IsString()
  search?: string;
}
```

`sortBy` is a free-text query param, so never interpolate it directly into
`.orderBy()`. Every sortable service declares a resource-specific allowlist
and resolves the effective column with `resolveSortField`:

```typescript
import { resolveSortField } from 'src/common/utils';

const VALID_SORT_FIELDS: (keyof Article)[] = ['createdAt'];

const orderField = resolveSortField(
  filter.sortBy,
  VALID_SORT_FIELDS,
  'createdAt',
);

qb.orderBy(`article.${orderField}`, filter.sortOrder ?? 'DESC');
```

Invalid `sortBy` values silently fall back to the resource default; they do
not produce `400 Bad Request`. `sortOrder` remains strictly `'ASC' | 'DESC'`.
Filtering fields such as `search`, `isBanned`, `startDate`, and `endDate` are
resource-specific and live on the filter DTO.

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

Transactions are powered by [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/plugins/available-plugins/transactional) with the TypeORM adapter (registered globally in `app.module.ts`). Use `@Transactional()` for operations that must succeed or fail together. Inside a transactional method, **all** database access must go through `this.txHost.tx` — the transaction-aware `EntityManager` from the injected `TransactionHost`. Outside a transaction, `txHost.tx` transparently falls back to the default manager, so the same code works in non-transactional methods too. Propagation is REQUIRED by default: a nested `@Transactional()` call reuses the active transaction rather than opening a new one.

> Use `this.txHost.tx` for both reads and writes inside transactional services — do **not** mix in `@InjectRepository(...)` repositories, as those bypass the active transaction and won't see uncommitted rows.

```typescript
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';

@Injectable()
export class OrderService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  @Transactional()
  async placeOrder(dto: PlaceOrderDto): Promise<Order> {
    // All queries in this method run in a single DB transaction
    const order = await this.txHost.tx.save(Order, { ...dto });
    await this.inventoryService.deductStock(dto.articleId, dto.quantity);
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

**Running code only after commit:** the installed version of `@nestjs-cls/transactional` does not expose a commit-hook API (no `runOnTransactionCommit`/equivalent). If something must happen only once a transaction has actually committed — e.g. enqueuing an audit-log write, so a later rollback can't leave a log entry for a change that never persisted — split the method into a private `@Transactional()` core and a public, non-transactional wrapper that awaits the core and runs the post-commit logic afterward. The wrapper's `await` only resolves once the decorator's wrapped promise settles, which happens after commit (or after rollback, if it throws):

```typescript
async create(dto: CreateRoleDto, adminId: string, request: Request) {
  const role = await this.createInTransaction(dto); // resolves only after commit
  await this.logQueueService.enqueueAuditLog({ /* ... */ });
  return role;
}

@Transactional()
private async createInTransaction(dto: CreateRoleDto) {
  /* ... */
}
```

See §11 for the full pattern as used in `RoleService`.

---

## 16. Key Decorators Reference

### Auth Decorators

| Decorator                            | Import From            | Effect                                                                           |
| ------------------------------------ | ---------------------- | -------------------------------------------------------------------------------- |
| `@Public()`                          | `src/modules/auth/public-api` | Bypasses JWT authentication                                                      |
| `@CurrentUser()`                     | `src/modules/auth/public-api` | Injects current authenticated user                                               |
| `@RequireSubject('USER' \| 'ADMIN')` | `src/modules/auth/public-api` | Asserts `subjectType` (needs `@UseGuards(SubjectGuard)`)                         |
| `@CheckOwnership()`                  | `src/modules/auth`     | Verifies resource belongs to caller (needs `@UseGuards(ResourceOwnershipGuard)`) |
| `@RequireRoles('admin', 'editor')`   | `src/modules/role`     | Restricts by role name (needs `@UseGuards(RolesGuard)`)                          |
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

Copy `.env.example` to `.env` and fill in all values. The Joi schema in [env.validation.ts](src/common/config/env.validation.ts) is the source of truth — it runs with `allowUnknown: true`, so vars not listed there (e.g. `SMTP_USERNAME`, `SMTP_USER_PASSWORD`) are read directly via `ConfigService` and are not validated. Variables marked **required** below abort startup if missing.

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

# JWT (JWT_SECRET, JWT_REFRESH_SECRET REQUIRED — must be 32+ chars)
JWT_SECRET=your-very-long-secret-here
JWT_REFRESH_SECRET=another-very-long-secret-here
JWT_EXPIRATION=900000            # 15 minutes in ms (default)
JWT_REFRESH_EXPIRATION=2592000000  # 30 days in ms (default)

# Redis
REDIS_HOST=localhost             # default localhost
REDIS_PORT=6379                  # default 6379
REDIS_PREFIX_KEY=nest-forge      # BullMQ/cache key prefix (default "nest-forge")

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

> **Note:** This template ships a single baseline migration, `CreateFoundationSchema`
> (`src/infrastructure/database/migrations/1784000000000-CreateFoundationSchema.ts`), which creates
> the full foundation schema in one pass — `synchronize` is `false`. It also carries the
> constraints TypeORM does not emit from decorators alone, including polymorphic-owner `CHECK`
> constraints (e.g. `CK_refresh_tokens_owner`, ensuring a `RefreshToken` belongs to exactly one of
> `User`/`Admin`) and enum-backed `CHECK` constraints (e.g. `CK_users_login_provider`,
> `CK_otp_records_status`, `CK_otp_records_purpose`). Run `forge db migrate run` to apply it, then
> generate further migrations the normal way as entities evolve.

### The `forge` CLI

The project ships a purpose-built CLI at `cli/` that wraps **all** database
operations under a single `forge db` command tree. It is the sole sanctioned
way to touch the database — there is no parallel `npm run migration:*` or
`npm run db:*` path, and no raw `npm run typeorm` escape hatch. It is
registered as a local binary in `package.json`:

```json
"bin": { "forge": "./cli/index.ts" }
```

Run it with `npx forge`:

```bash
npx forge db --help
```

**Why a dedicated CLI instead of raw `npm run` / TypeORM CLI scripts?**

| | `forge` CLI |
| --------------------- | ----------------------------------------------------- |
| Migration output path | Enforced to `src/infrastructure/database/migrations/` |
| Naming | Just pass the name: `AddArticleTable` |
| Discoverability | `forge db --help` lists all sub-commands |
| Prod safety | `--prod` flag with a confirmation gate on destructive ops |

See [ADR-0012](docs/adr/0012-forge-cli-as-primary-database-tool.md) for the
full rationale.

### `forge db` Command Tree

```
forge db
├── migrate
│   ├── generate <name>          Generate a migration into src/infrastructure/database/migrations/ (dev only)
│   ├── run [--prod]             Apply all pending migrations
│   ├── revert [--prod] [--yes]  Revert the last applied migration
│   └── status [--prod]          Show applied and pending migrations
├── seed [--prod]                 Run all seeders
├── clear [--prod] [--yes]        Delete all data
└── reset [--prod] [--yes]        clear + seed in sequence
```

Every command runs against `src/data-source.ts` via `ts-node` by default. Pass
`--prod` to instead run against the compiled build
(`dist/src/data-source.js`, executed with plain `node`/`typeorm` — no
`ts-node`); `forge` errors immediately if `dist/` hasn't been built yet.
`migrate generate` never accepts `--prod` — migrations are always generated
from TypeScript source.

`migrate revert --prod`, `clear --prod`, and `reset --prod` are destructive
against a production database, so they print the resolved `DB_HOST`/`DB_NAME`
and require typing `yes` to continue. Pass `-y`/`--yes` to skip the prompt
(e.g. in CI).

### Migration Commands

```bash
# Generate a new migration — just provide the name, path is enforced automatically
npx forge db migrate generate AddArticleTable
# Creates: src/infrastructure/database/migrations/<timestamp>-AddArticleTable.ts

# Apply all pending migrations
npx forge db migrate run
npx forge db migrate run --prod

# Revert the last applied migration
npx forge db migrate revert
npx forge db migrate revert --prod   # prompts for confirmation

# Show applied/pending migrations
npx forge db migrate status
npx forge db migrate status --prod
```

> **Tip:** Always review the generated migration file before running it. TypeORM infers the schema diff but can emit unexpected `DROP COLUMN` statements when column options change.

### Seeding Commands

```bash
# Seed the database (creates roles, permissions, superadmin, settings)
npx forge db seed

# Clear all data
npx forge db clear
npx forge db clear --prod   # prompts for confirmation

# Reset = clear + seed (sequential, exits on clear failure)
npx forge db reset
npx forge db reset --prod --yes   # non-interactive, e.g. CI
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
3. **Use the right barrel — no deep imports.** Controllers import from `public-api.ts`. Domain services import services from `public-api.ts` and entities/events from `index.ts`. No symbol appears in both barrels. Own-module code uses relative direct imports.
4. **Always extend `BaseEntity`.** No entity without UUID, timestamps, and soft delete.
5. **Never use `synchronize: true`** in TypeORM config. Always write migrations.
6. **Never store presigned URLs in the database.** Store the S3 key only.
7. **Never send emails/SMS synchronously.** Always queue them via `NotificationService`.
8. **Always validate environment variables.** Add new vars to the Joi schema in `env.validation.ts`.
9. **Respect module boundaries — they're linted.** `no-restricted-imports` and `import-x/no-cycle` in `eslint.config.mjs` enforce barrel imports and reject circular dependencies. Barrels are side-effect-free named export manifests only. Run `npm run lint`.
10. **Never use a native database `enum` type.** Use `varchar` + a TS `enum` + a migration `CHECK` constraint instead (see §9 and ADR-0009).

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

### Database & Query Performance

**Avoid N+1 queries.** Never load a relation by calling a `findOne`/service lookup once per row in a loop — load it in the same query instead.

```typescript
// ❌ WRONG — one query per admin (N+1)
const admins = await this.adminRepository.find();
for (const admin of admins) {
  admin.role = await this.roleRepository.findOne({ where: { id: admin.roleId } });
}

// ✅ Simple lookup by id — use `relations`
const admin = await this.adminRepository.findOne({
  where: { id },
  relations: ['role'],
});

// ✅ Filtered/paginated list, or multi-level relations — use the query builder
const [admins, total] = await this.adminRepository
  .createQueryBuilder('admin')
  .leftJoinAndSelect('admin.role', 'role')
  .skip(skip)
  .take(limit)
  .getManyAndCount();
```

Use `relations: [...]` for a simple lookup by id; use `createQueryBuilder` + `leftJoinAndSelect` once filtering, pagination, ordering, or multi-level relations are involved. Always paginate list endpoints via `PaginationFilterDto`/`SortableFilterDto` (`skip`/`take`, `getAll` opt-out — see §14 and [docs/pagination-filtering-sorting.md](docs/pagination-filtering-sorting.md)); don't hand-roll a second pagination shape.

Never set `eager: true` on a relation — always load relations explicitly (`relations:`/`leftJoinAndSelect`) so each call site controls its own query cost instead of paying for a join it doesn't need.

Every `@ManyToOne` sets `onDelete` explicitly — never leave it to the TypeORM default. Pick based on ownership:

| Relationship                                          | `onDelete` |
| ------------------------------------------------------ | ---------- |
| Owned child record (e.g. `RefreshToken` → `User`)      | `CASCADE`  |
| Optional/nullable reference (e.g. `AuditLog` → `Admin`) | `SET NULL` |
| Protected reference data (e.g. `Admin` → `Role`)        | `RESTRICT` |

### Request-Level Performance & Caching

The app already wires up `CacheModule` globally (`app.module.ts`, Redis-backed, default TTL 600s). Use it for hot reads that don't need to be strictly real-time, following the existing convention (`src/modules/auth/services/registration-session.service.ts`):

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ArticleService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  private getKey(id: string): string {
    return `article:${id}`;
  }

  async findById(id: string): Promise<Article> {
    const cached = await this.cacheManager.get<Article>(this.getKey(id));
    if (cached) return cached;

    const article = await this.articleRepository.findOneOrFail({ where: { id } });
    await this.cacheManager.set(this.getKey(id), article, 300 * 1000); // explicit TTL, don't rely on the global default when it doesn't fit
    return article;
  }

  async update(id: string, dto: UpdateArticleDto): Promise<Article> {
    const article = await this.articleRepository.save({ id, ...dto });
    await this.cacheManager.del(this.getKey(id)); // invalidate in the same method that writes
    return article;
  }
}
```

**Rule:** any service that caches a read must invalidate (`cacheManager.del`) the corresponding key(s) in every method that writes/updates/deletes that same data. Cache and database must never be allowed to silently diverge.

Never perform blocking or CPU-heavy work synchronously in the request path — if it isn't needed for the immediate response, queue it (see §13's BullMQ pattern) rather than making the caller wait.

### General Backend Hygiene

- **Idempotency:** for mutation endpoints a client may retry (e.g. after a timeout), rely on the existing partial-unique-index + `23505` → `409 Conflict` mapping (§9, ADR-0007) as the safety net rather than building bespoke idempotency-key infrastructure.
- **Defensive timeouts on outbound calls:** third-party calls (S3, SMS, OAuth) should set their own client-level timeout rather than relying solely on the global 10s controller timeout (`@RequestTimeout`, §16) — a slow outbound call should fail fast, not just cut off the HTTP response.
- **N+1 across module boundaries too:** if a loop calls another module's service method once per item, check whether that service should expose a batch method instead of accepting the per-item round trips.

---

## 20. Common Mistakes to Avoid

| Mistake                                                                  | Correct Approach                                                                                                 |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Writing audit/activity logs synchronously from a controller              | Call `LogQueueService.enqueueActivityLog()`/`enqueueAuditLog()` from the service, only after the write succeeds  |
| Controller importing from `index.ts`                                     | `index.ts` has no services or DTOs — controllers must use `public-api.ts`                                               |
| Domain service importing an entity or event from `public-api.ts`                | Entities and events live in `index.ts` — `public-api.ts` has no entities                                                |
| Domain service importing a service from `index.ts`                       | Services live in `public-api.ts` — use `import { FooService } from 'src/modules/foo/public-api'`                               |
| Re-exporting the same symbol in both barrels                             | Each symbol has exactly one home: services/DTOs/decorators → `public-api.ts`; module class/entities/events → `index.ts` |
| Importing deep into a module (`src/modules/auth/services/token.service`) | Import from the correct barrel: `public-api.ts` for services/DTOs, `index.ts` for entities/events                       |
| Using wildcard exports in a barrel (`export * from ...`)                 | Use named exports only so public API growth is explicit                                                          |
| Importing a module's own barrel from inside that same module             | Use relative direct imports (`../entities/user.entity`) to avoid self-cycles                                      |
| Adding nested domain barrels (`dto/index.ts`, `services/index.ts`)        | Only module-root `index.ts`/`public-api.ts` are domain boundary barrels                                                  |
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
import { Entity, Column } from 'typeorm';
import { BaseEntity } from 'src/common/entities';

@Entity('articles')
export class Article extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;
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
# Using the forge CLI (recommended — path is enforced automatically):
npx ts-node -r tsconfig-paths/register cli/index.ts db migrate generate CreateArticlesTable
npx ts-node -r tsconfig-paths/register cli/index.ts db migrate run

# Or via npm run aliases:
npm run migration:generate src/infrastructure/database/migrations/CreateArticlesTable
npm run migration:run
```

### Step 10 — Verify

```bash
npm run start:dev
# Test endpoints at http://localhost:3000/api/v1/articles
```

---

## 22. Quality Gates

Two independent checkpoints enforce code health — one local (fast, staged-files-only), one in CI (full project, every PR).

### Pre-commit (`.husky/pre-commit`) — runs on every commit

```
npx lint-staged   # Prettier --write + ESLint --fix, staged src/**/*.ts and test/**/*.ts only (.lintstagedrc)
npm run knip      # Unused files, exports, and dependencies — full project (knip.json), not just staged files
```

`knip.json` defines the project's entry points (`src/main.ts`, `src/data-source.ts`, migrations, tests) and scans `src/**/*.ts`, `cli/**/*.ts`, `test/**/*.ts` for anything unreachable from them.

### CI (`.github/workflows/ci.yml`) — runs on every PR and push to `main`, in order

1. `npm run lint:check` — ESLint, **no** `--fix`: a violation fails the build instead of silently patching it.
2. `npm run typecheck` — `tsc --noEmit`: the whole project must compile with zero type errors.
3. `npm test` — Jest unit tests.
4. `npm run build` — the Nest build must succeed.

### Rules

- Never bypass these with `--no-verify` or by disabling a script — fix the underlying issue instead.
- Run `npm run typecheck` locally before pushing; don't rely on CI to be the first place a type error surfaces.
- **Handling a knip false positive:** first check whether the file/export is genuinely dead — if so, delete it; don't suppress the finding. Only add an entry to `knip.json`'s ignore config when the symbol is a deliberately-kept public API surface knip can't infer (e.g. exported for an external consumer, referenced dynamically) — and leave a one-line comment at the ignore entry explaining why, so it doesn't read as stale later.

These gates run alongside the module-boundary linting already described in §5 (Automated Enforcement) and the migration discipline in §9 — this section is about *what runs and when*, not a restatement of those rules.

---

## Quick Reference Card

```
Adding a module?        Follow the 10-step checklist in Section 21.
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
