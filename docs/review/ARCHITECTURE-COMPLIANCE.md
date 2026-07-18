# Architecture Compliance Rubric

> **Source of truth** for automated code review of `nest-forge`. Tool-agnostic — any AI
> agent (Claude Code, Codex, Cursor, …) follows this file. The `architecture-review`
> Claude skill and root `AGENTS.md` are thin wrappers that point here.
>
> **Authoritative docs:** [`ARCHITECTURE.md`](../../ARCHITECTURE.md), [`CONTEXT.md`](../../CONTEXT.md),
> [`docs/adr/`](../adr/). When a rule and the cited source disagree, the source wins —
> see [Drift](#drift).

## How to use this rubric

1. **Pick the file set.**
   - _Diff mode_ (default): files changed since the merge-base with `main`.
   - _Audit mode_ (`--audit`): the whole `src/` tree.
2. **Run the mechanical checks first** — see the [Mechanical command appendix](#mechanical-command-appendix). Capture output; do not re-derive these by reading code.
3. **Reason over the `semantic` rules only**, scoped to the file set. Mechanical rules are already covered by step 2.
4. **Emit the report** — see [Report format](#report-format). Advisory only: never edit code.

Each rule: `id` · statement · **category** (Architecture / Standards / Security) · **type**
(`mechanical` = a command finds it; `semantic` = needs reasoning) · **severity** · **source**.

---

## Architecture

| id          | rule                                                                                                                                                                                                                         | type                  | severity | source                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------- | -------------------------------- |
| **ARCH-01** | A domain service must not inject another module's repository (`@InjectRepository(ForeignEntity)`). Call that module's exported service instead.                                                                              | semantic              | high     | §19 #2 / ADR-0004                |
| **ARCH-02** | Controllers contain zero business logic — no repository access, `save`, `bcrypt`, branching, or data transformation. They call a service and return.                                                                         | semantic              | high     | §4 Zone 1 / §19 #1               |
| **ARCH-03** | Controllers import from a module's `public-api.ts` only — never `index.ts`, never a deep path (`/services/*`, `/dto/*`, `/entities/*`).                                                                                             | mechanical + semantic | high     | §5 / §19 #3 / ADR-0013           |
| **ARCH-04** | Domain services import _services_ from `public-api.ts` and _entities/events_ from `index.ts`. No symbol from the wrong barrel. HTTP DTO reuse across modules requires an intentional service-contract reason.                       | semantic              | medium   | §5 / ADR-0013                    |
| **ARCH-05** | Every domain module under `src/modules/` exposes both `index.ts` and `public-api.ts`, with no symbol exported from both. Barrels use named exports only, `export type` for type-only symbols, and contain no runtime side effects.   | mechanical            | medium   | §5 / ADR-0013                    |
| **ARCH-06** | App-zone endpoints (`src/api/v1/app/**`) map the entity to a whitelist response DTO via `plainToInstance(Dto, x, { excludeExtraneousValues: true })` and derive the target from `@CurrentUser()` — never a `:id` path param. | semantic              | high     | §4 / §7 / ADR-0006               |
| **ARCH-07** | An endpoint restricted to one subject type uses `@UseGuards(SubjectGuard)` + `@RequireSubject('USER'\|'ADMIN')`. The whole `app/` zone is USER-only.                                                                         | semantic              | medium   | §8 / ADR-0006                    |
| **ARCH-08** | No circular import dependencies between files (e.g. service A → B → A through barrels). `*.entity.ts` files are exempt — bidirectional TypeORM relations form intentional, lazily-resolved cycles.                           | mechanical            | medium   | §5 (Automated Enforcement) / §20 |
| **ARCH-09** | Barrel files exist only at sanctioned boundaries: `src/modules/*/{index,public-api}.ts` and `src/common/*/index.ts`. No nested domain barrels (`dto/index.ts`, `services/index.ts`) and no `src/common/index.ts` mega-barrel. | mechanical            | medium   | §5 / ADR-0013                    |
| **ARCH-10** | A module's own implementation files must not import from that same module's root barrel (`src/modules/<same>` or `src/modules/<same>/public-api`). Use relative direct imports inside the owning module.                     | mechanical + semantic | medium   | §5 / ADR-0013                    |

## Standards

| id         | rule                                                                                                                                                                                                                                                                       | type                  | severity | source            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------- | ----------------- |
| **STD-01** | Entities extend `BaseEntity`. Append-only log tables may extend `BaseEntity` or use a documented raw-entity exception (`activity-log`, `audit-log` — integer PK for volume); many-to-many join tables (e.g. `role_permissions`) may use a raw entity with a composite key. | mechanical            | medium   | §9                |
| **STD-02** | No `@Column({ unique: true })` on a soft-deletable entity. Scope uniqueness with a partial unique index `where: '"deletedAt" IS NULL'`.                                                                                                                                    | mechanical            | high     | §9 / ADR-0007     |
| **STD-03** | Soft delete only (`@DeleteDateColumn` + `softRemove`). Never physically delete rows.                                                                                                                                                                                       | semantic              | medium   | §9                |
| **STD-04** | Sensitive columns (passwords, secrets) carry `@Exclude()` and `{ select: false }`.                                                                                                                                                                                         | semantic              | high     | §9 / §19 security |
| **STD-05** | No `console.log` in `src/` (seeders/tests excepted). Use `Logger` from `@nestjs/common`.                                                                                                                                                                                   | mechanical            | low      | §19               |
| **STD-06** | Injected deps are `readonly`; service methods have explicit return types.                                                                                                                                                                                                  | semantic              | low      | §19 code quality  |
| **STD-07** | Update DTOs use `PartialType(CreateDto)`. List/filter DTOs extend `PaginationFilterDto` or `SortableFilterDto` (don't redefine `page`/`limit`/`getAll`). Sortable services use `resolveSortField` with a resource-specific `VALID_SORT_FIELDS` allowlist before `.orderBy()`. | semantic              | medium   | §14 / ADR-0010 / docs/pagination-filtering-sorting.md |
| **STD-08** | Never `synchronize: true` in TypeORM config. Schema changes go through migrations.                                                                                                                                                                                         | mechanical            | high     | §9 / §19 #5       |
| **STD-09** | `@LogActivity` only on authenticated endpoints. `@Public()` endpoints emit `ActivityLogEvent`/`AuditLogEvent` from the service instead (no `request.user` pre-auth).                                                                                                       | semantic              | medium   | §11 / §20         |
| **STD-10** | Multi-write operations are wrapped in `@Transactional()`; the class injects `TransactionHost<TransactionalAdapterTypeOrm>` and performs all DB access via `this.txHost.tx` (never `@InjectRepository`/`@InjectDataSource`, which bypass the active transaction).           | semantic              | medium   | §15 / ADR-0008    |
| **STD-11** | New env vars are added to the Joi schema in `src/common/config/env.validation.ts`.                                                                                                                                                                                         | mechanical + semantic | low      | §17 / §19 #8      |
| **STD-12** | No `@Column({ type: 'enum', ... })` on any entity. Enum-like columns are `varchar` + a TS enum + a migration `CHECK` constraint.                                                                                                                                           | mechanical            | high     | §9 / ADR-0009     |
| **STD-13** | No `eager: true` on `@ManyToOne`/`@OneToMany`/`@ManyToMany`. Relations are always loaded explicitly (`relations:`/`leftJoinAndSelect`).                                                                                                                                    | mechanical            | medium   | §19 performance   |
| **STD-14** | Every `@ManyToOne` sets `onDelete` explicitly (`CASCADE`/`SET NULL`/`RESTRICT` per ownership — never the TypeORM default).                                                                                                                                                 | mechanical            | low      | §19 performance   |
| **STD-15** | A service that reads through `cacheManager.get`/`.set` for a resource also calls `cacheManager.del` (or overwrites the same key) in the corresponding write path — cache and DB must not silently diverge.                                                                 | semantic              | medium   | §19 caching       |
| **STD-16** | `npm run typecheck` and `npm run knip` introduce no _new_ errors/findings versus the pre-change baseline (the repo has pre-existing knip findings not yet cleaned up — flag only findings the diff introduces, not the existing baseline).                                 | mechanical            | high     | §22               |

## Security

| id         | rule                                                                                                                                                                                                                                                                                       | type     | severity | source       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | ------------ |
| **SEC-01** | Passwords are hashed via `PasswordHashUtil`, never hand-rolled `bcrypt`/`bcryptjs` calls in services.                                                                                                                                                                                      | semantic | high     | §19 security |
| **SEC-02** | Never log passwords, tokens, OTPs, or secrets (no logger/console call with such a value).                                                                                                                                                                                                  | semantic | high     | §19 security |
| **SEC-03** | Emails are queued via `NotificationService`, never sent inline (no direct `nodemailer` call in a request path). SMS OTP send/verify is a deliberate synchronous exception (§13) — direct `SMSPohService` calls in `UserAuthService`/`PasswordResetService` are compliant, not a violation. | semantic | medium   | §13 / §19 #7 |
| **SEC-04** | Store the S3 **key** in the DB; never a presigned URL. Resolve URLs at response time with `@ResolvePresignedUrls`.                                                                                                                                                                         | semantic | medium   | §12 / §19 #6 |

---

## Mechanical command appendix

Run from the repo root. These are **read-only** (no `--fix`). Capture and report the output.

```bash
# Lint (boundary + style rules; eslint.config.mjs already blocks deep imports → ARCH-03)
npx eslint "{src,apps,libs,test}/**/*.ts"

# ARCH-08 — circular dependencies (same eslint run; filter for the rule)
npx eslint "{src,apps,libs,test}/**/*.ts" 2>&1 | grep "no-cycle"

# Type check (STD-16)
npx tsc --noEmit -p tsconfig.json

# STD-16 — unused files/exports/dependencies (knip.json config). Repo has a pre-existing
# baseline of findings (see §22) — only new findings vs. the pre-change state count.
npm run knip

# STD-05 — console.log outside seeders/tests
grep -rnE "console\.(log|debug|info)" src --include="*.ts" | grep -vE "/seeders/|\.spec\.ts"

# STD-02 — unconditional unique column (review each hit: is the entity soft-deletable?)
grep -rnE "@Column\([^)]*unique:\s*true" src/modules --include="*.entity.ts"

# STD-08 — synchronize: true anywhere
grep -rnE "synchronize:\s*true" src --include="*.ts"

# STD-01 — entities not extending BaseEntity/BaseEntity (review each hit)
grep -rL "extends BaseEntity\|extends BaseEntity" src/modules/**/entities/*.entity.ts

# ARCH-05 — every module has both barrels (a module missing either is a violation)
for d in src/modules/*/; do
  [ -f "$d/index.ts" ] || echo "missing index.ts: $d"
  [ -f "$d/public-api.ts" ]   || echo "missing public-api.ts: $d"
done

# ARCH-05 — wildcard exports in sanctioned barrels (should be named exports only)
grep -rnE "export[[:space:]]+\\*" src/modules/*/index.ts src/modules/*/public-api.ts src/common/*/index.ts

# ARCH-09 — unsanctioned barrels (review hits; module root barrels and common subfolder barrels are allowed)
find src/modules src/common -path "src/modules/*/index.ts" -prune -o -path "src/modules/*/public-api.ts" -prune -o -path "src/common/*/index.ts" -prune -o -name "index.ts" -print

# ARCH-01 candidates — @InjectRepository inside a service (review: is the entity from another module?)
grep -rn "@InjectRepository" src/modules/*/services --include="*.ts"

# SEC-01 candidates — raw bcrypt in a service (should be PasswordHashUtil)
grep -rnE "bcrypt(js)?\.(hash|compare)" src/modules --include="*.ts"

# STD-12 — native DB enum columns (should be varchar + TS enum + CHECK constraint)
grep -rnE "@Column\([^)]*type:\s*['\"]enum['\"]" src/modules --include="*.entity.ts"

# STD-13 — eager relation loading
grep -rnE "eager:\s*true" src/modules --include="*.entity.ts"

# STD-14 — @ManyToOne candidates (review each hit: does the decorator set onDelete?)
grep -rn "@ManyToOne" src/modules --include="*.entity.ts"

# STD-15 candidates — services using cache-manager (review: does every write path del/overwrite the key it reads?)
grep -rln "CACHE_MANAGER\|cacheManager\." src/modules --include="*.service.ts"
```

> ARCH-03 and ARCH-08 are enforced by ESLint in `eslint.config.mjs`: a `no-restricted-imports`
> error is an ARCH-03 finding; an `import-x/no-cycle` error is an ARCH-08 finding. Both rules are
> exempted for `*.entity.ts` (sanctioned cross-module entity imports), so an entity importing
> another entity's file directly is **not** a finding. The `grep` rules surface _candidates_ —
> confirm each with reasoning before reporting (e.g. ARCH-01: only cross-module injections count;
> same-module `@InjectRepository` is fine).

## Report format

Group findings by severity (High → Medium → Low). Separate **Mechanical** and **Semantic**
findings. Each finding:

```
[ARCH-01] high · src/modules/<module>/services/<name>.service.ts:NN   (illustrative)
  rule:   A domain service must not inject another module's repository.
  source: ARCHITECTURE.md §19 #2 / ADR-0004
  detail: Service injects @InjectRepository(ForeignEntity) owned by another module.
  fix:    Inject the owning module's service (e.g. UserService) and call its method instead.
```

End with a summary table (counts by category × severity) and the raw mechanical-tool output
(eslint/tsc) in a collapsed block. **Advisory only — propose fixes, never apply them.**

## Drift

Every rule cites its source (`ARCHITECTURE.md` / `ADR-NNNN`). In `--audit` mode, do a final
pass: spot-check that each cited section still says what the rule claims. If `ARCHITECTURE.md` or
an ADR has changed, flag the stale rule rather than enforcing it. The source always wins.
