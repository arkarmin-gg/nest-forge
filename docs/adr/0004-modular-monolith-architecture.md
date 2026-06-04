# ADR-0004: Adopt Full Modular Monolith Architecture

## Status

Accepted

## Context

The project grew organically with NestJS modules providing loose boundaries, but several practices accumulated that violate Modular Monolith principles:

- All domain modules nested under `src/v1/`, conflating API versioning with module boundaries.
- Infrastructure modules (`notification/`, `health/`) placed inconsistently at `src/` root.
- No explicit public API contracts per module — consumers import from deep internal paths.
- Cross-module repository access: `AdminModule` registers `Role` (owned by `AuthModule`); `AuthModule` injects `User` and `Admin` repositories directly.
- `OtpModule` re-exports `TypeOrmModule` so consumers can access `OtpRecord` repository directly.
- OTP lifecycle logic (create, verify, expire, mark-used) duplicated in `TwoFactorService` and `PasswordResetService` instead of owned by `OtpService`.
- `ActivityLogModule` imported directly by `AuthModule` and `SettingModule` as a hard dependency, creating tight coupling across domain modules.

## Decision

Restructure the project to fully adhere to Modular Monolith Architecture with the following rules:

### 1. Four-zone directory structure

```
src/
├── modules/              ← domain modules (business logic + entities)
│   ├── auth/
│   ├── user/
│   ├── admin/
│   ├── otp/
│   ├── log/
│   └── setting/
├── api/
│   └── v1/               ← HTTP layer only (controllers + DTOs, no business logic)
│       ├── auth/
│       ├── user/
│       ├── admin/
│       ├── log/
│       └── setting/
├── infrastructure/       ← technical plumbing (no business logic)
│   ├── notification/
│   ├── health/
│   └── database/
└── common/               ← shared cross-cutting utilities
```

### 2. Explicit module public API via index.ts

Each domain module exposes an `index.ts` barrel file as its contract. Cross-module imports must go through this file — never via deep internal paths. Enforced via ESLint `no-restricted-imports`.

### 3. No cross-module repository access

A module only registers and injects its own entities. Cross-module data access goes through the owning module's exported service. Specifically:

- `AuthModule` removes `User` and `Admin` from `TypeOrmModule.forFeature()` and calls `UserService`/`AdminService` instead.
- `AdminModule` removes `Role` from `TypeOrmModule.forFeature()` and calls `RoleService` from `AuthModule`.
- `OtpModule` removes the `TypeOrmModule` re-export; `OtpRecord` is never accessed outside `OtpModule`.

Exception: seeders (bootstrap utilities) may use direct repository access.

### 4. OTP lifecycle owned exclusively by OtpService

All OTP create/verify/expire/invalidate logic moves into `OtpService`. `TwoFactorService` and `PasswordResetService` call `OtpService` methods only.

### 5. Event-driven cross-cutting concerns

`ActivityLogModule` becomes a pure event listener. Domain modules emit `activity.log` and `audit.log` events via `EventEmitter2` instead of injecting `ActivityLogService`/`AuditLogService` directly. This removes `ActivityLogModule` from the import graph of all domain modules.

## Consequences

**Benefits:**
- Module boundaries are enforced structurally, not just by convention.
- Adding a new module or feature has a clear, consistent location.
- Domain modules can be reasoned about and tested in isolation.
- Logging cross-cutting concern does not pollute the domain module dependency graph.
- Public API contracts make refactoring internals safe.

**Costs:**
- Significant refactor across `AuthModule`, `UserModule`, `AdminModule`, `OtpModule`, and `ActivityLogModule`.
- `UserService` and `AdminService` need auth-oriented methods added (findByPhone, findByEmail, updatePassword, etc.).
- TypeORM migrations are unaffected — this is a code-layer restructuring only.
