# ADR-0009: `varchar` + `CHECK` constraints instead of native database enums

## Status

Accepted

## Context

The codebase already, consistently, avoids Postgres's native `enum` type for enum-like columns — it just never wrote the rule down. Every example follows the same three-layer shape:

1. **A TypeScript enum or `const ... as const` object is the source of truth** — e.g. `OtpStatus` and `OtpPurpose` (`src/modules/otp/constants/otp-status.enum.ts`, `otp-purpose.enum.ts`), `LoginProvider` (`src/modules/user/constants/login-provider.enum.ts`), `LogAction`/`LogStatus` (`src/modules/log/constants/`).
2. **DTOs validate against it** with `@IsEnum(...)` (e.g. `src/modules/log/dto/filter-audit-log.dto.ts`).
3. **The entity column is `varchar`, not a native enum**, typed in TS by the same enum:
   - `src/modules/user/entities/user.entity.ts:71` — `@Column({ type: 'varchar', nullable: true }) loginProvider?: LoginProvider;`
   - `src/modules/otp/entities/otp-record.entity.ts:36-40` — `@Column({ type: 'varchar', default: OtpStatus.PENDING }) status!: OtpStatus;` and `@Column({ type: 'varchar' }) purpose!: OtpPurpose;`

The database enforces the allowed value set with a plain `CHECK` constraint added in the same migration, not a DB-native enum type:

- `src/infrastructure/database/migrations/1784000000000-CreateFoundationSchema.ts:94` — `ALTER TABLE "users" ADD CONSTRAINT "CK_users_login_provider" CHECK ("login_provider" IS NULL OR "login_provider" IN ('SMS', 'GOOGLE', 'APPLE'))`, on a `character varying` column (line 70).
- Same file, `:138` — `CK_otp_records_status` — `CHECK ("status" IN ('PENDING', 'VERIFIED', 'EXPIRED', 'USED'))`.
- Same file, `:141` — `CK_otp_records_purpose` — `CHECK ("purpose" IN ('RESET_PASSWORD'))`, both on `character varying` columns (line 120).

Because this was never written down, nothing stops a future entity from reaching for `@Column({ type: 'enum', enum: X })` instead — which would silently introduce a second, inconsistent pattern.

## Decision

Enum-like columns are always `varchar` (length judged per field — long enough for the longest current value, not a fixed universal width), typed in TypeScript by an `enum` (or `const ... as const` object), validated in DTOs with `@IsEnum`, and backed by a mandatory `CHECK (col IN (...))` constraint added in the same migration that creates or alters the column. Never `@Column({ type: 'enum', ... })`, and never a Postgres native `CREATE TYPE ... AS ENUM`.

The TypeScript enum is the single source of truth. The `CHECK` constraint's value list must exactly mirror the enum's values.

## Alternatives considered

- **Native Postgres `enum` type** (`@Column({ type: 'enum', enum: X })`, TypeORM emitting `CREATE TYPE`). Rejected:
  - Adding or renaming a value requires `ALTER TYPE ... ADD VALUE`, which historically could not run inside a transaction and is still awkward to sequence in TypeORM migrations (a value can't be removed at all without recreating the type).
  - TypeORM's enum-diffing on `migration:generate` is failure-prone — it tends to regenerate the whole type on unrelated entity changes.
  - It creates two sources of truth (the DB enum type and the TS enum) that can silently drift, since nothing forces them to be edited together the way a `CHECK` constraint's literal value list does when read next to the TS enum in the same migration file.
- **No DB-level enforcement at all** (rely solely on `@IsEnum` + TS typing). Rejected: app-layer validation only protects the HTTP path — direct DB writes (seeders, migrations, manual fixes, a future admin script) would have no backstop, unlike the `23505`/`23503`-style constraint safety net already used elsewhere (see ADR-0007).

## Consequences

**Benefits:**

- One consistent, already-battle-tested pattern across `user`, `otp`, and `log` modules — new modules have no ambiguity to resolve.
- Adding or renaming a value is a normal migration: update the TS enum, then `DROP CONSTRAINT` + `ADD CONSTRAINT` with the new value list. No `ALTER TYPE` edge cases.
- DB-level enforcement survives even if application-layer validation is bypassed.

**Costs / caveats:**

- Two places must be kept in sync by hand: the TS enum and the migration's `CHECK` value list. A mismatch (e.g. a new enum member with no matching migration) fails at insert time with a generic constraint-violation error, not a descriptive validation message — reviewers should check both are updated together in the same PR.
- `varchar` offers no autocomplete/type safety at the raw-SQL or seeder level the way a native DB enum's catalog type would — this is an accepted tradeoff for migration simplicity.
