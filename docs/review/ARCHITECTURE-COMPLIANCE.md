# Architecture Compliance Rubric

> **Source of truth** for automated code review of `nest-forge`. Tool-agnostic — any AI
> agent (Claude Code, Codex, Cursor, …) follows this file. The `architecture-review`
> Claude skill and root `AGENTS.md` are thin wrappers that point here.
>
> **Authoritative docs:** [`ARCHITECTURE.md`](../../ARCHITECTURE.md),
> [`CONTEXT.md`](../../CONTEXT.md),
> [`docs/database-standards.md`](../database-standards.md),
> [`docs/security-standards.md`](../security-standards.md), and
> [`docs/adr/`](../adr/). When a rule and the cited source disagree, the
> source wins — see [Drift](#drift).

## How to use this rubric

`forge quality check` is the executable form of the mechanical parts of this
rubric. `forge quality rules` labels each rule as implemented, delegated,
review-candidate, or planned. `forge quality check` fails on proven violations,
emits warning/review prompts where the rule needs judgment, and supports
`--audit`, `--base`, `--json`, `--fail-on-warn`, `--no-build`, and
`--rule <id>`.

1. **Pick the file set.**
   - _Diff mode_ (default): files changed since the merge-base with `main`.
   - _Audit mode_ (`--audit`): the whole `src/` tree.
2. **Run the mechanical checks first** — see the [Mechanical command appendix](#mechanical-command-appendix). Capture output; do not re-derive these by reading code.
3. **Reason over the `semantic` rules only**, scoped to the file set. Mechanical rules are already covered by step 2.
4. **Emit the report** — see [Report format](#report-format). Advisory only: never edit code.

Each rule: `id` · statement · **category** (Architecture / Database / DTO & Query /
Security / Operations & Quality) · **type** (`mechanical` = a command finds it;
`semantic` = needs reasoning) · **severity** · **source**.

---

## Architecture

| id          | rule                                                                                                                                                                                                                               | type                  | severity | source                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------- | -------------------------------- |
| **ARCH-01** | A domain service must not inject another module's repository (`@InjectRepository(ForeignEntity)`). Call that module's exported service instead.                                                                                    | semantic              | high     | §4 Zone 2 / ADR-0004             |
| **ARCH-02** | Controllers contain zero business logic — no repository access, `save`, `bcrypt`, branching, or data transformation. They call a service and return.                                                                               | semantic              | high     | §4 Zone 1 / §20                  |
| **ARCH-03** | Controllers import from a module's `public-api.ts` only — never `index.ts`, never a deep path (`/services/*`, `/dto/*`, `/entities/*`).                                                                                            | mechanical + semantic | high     | §5 / ADR-0013                    |
| **ARCH-04** | Domain services import _services_ from `public-api.ts` and _entities/events_ from `index.ts`. No symbol from the wrong barrel. HTTP DTO reuse across modules requires an intentional service-contract reason.                      | semantic              | medium   | §5 / ADR-0013                    |
| **ARCH-05** | Every domain module under `src/modules/` exposes both `index.ts` and `public-api.ts`, with no symbol exported from both. Barrels use named exports only, `export type` for type-only symbols, and contain no runtime side effects. | mechanical            | medium   | §5 / ADR-0013                    |
| **ARCH-06** | App-zone endpoints (`src/api/v1/app/**`) map the entity to a whitelist response DTO via `plainToInstance(Dto, x, { excludeExtraneousValues: true })` and derive the target from `@CurrentUser()` — never a `:id` path param.       | semantic              | high     | §4 / §7 / ADR-0006               |
| **ARCH-07** | An endpoint restricted to one subject type uses `@UseGuards(SubjectGuard)` + `@RequireSubject('USER'\|'ADMIN')`. The whole `app/` zone is USER-only.                                                                               | semantic              | medium   | §8 / ADR-0006                    |
| **ARCH-08** | No circular import dependencies between files (e.g. service A → B → A through barrels). `*.entity.ts` files are exempt — bidirectional TypeORM relations form intentional, lazily-resolved cycles.                                 | mechanical            | medium   | §5 (Automated Enforcement) / §21 |
| **ARCH-09** | Barrel files exist only at sanctioned boundaries: `src/modules/*/{index,public-api}.ts` and `src/common/*/index.ts`. No nested domain barrels (`dto/index.ts`, `services/index.ts`) and no `src/common/index.ts` mega-barrel.      | mechanical            | medium   | §5 / ADR-0013                    |
| **ARCH-10** | A module's own implementation files must not import from that same module's root barrel (`src/modules/<same>` or `src/modules/<same>/public-api`). Use relative direct imports inside the owning module.                           | mechanical + semantic | medium   | §5 / ADR-0013                    |

## Database

| id         | rule                                                                                                                                                                                                                                             | type                  | severity | source                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | -------- | ------------------------------------- |
| **STD-01** | Entities use the correct base shape: normal mutable domain records extend `SoftDeletableEntity`; lifecycle records extend `BaseEntity`; raw entity exceptions are documented for append-only logs and pure join tables.                          | mechanical + semantic | medium   | docs/database-standards.md            |
| **STD-02** | No `@Column({ unique: true })` on a soft-deletable entity. Scope uniqueness with a partial unique index `where: '"deleted_at" IS NULL'`.                                                                                                         | mechanical            | high     | docs/database-standards.md / ADR-0007 |
| **STD-03** | Soft-deletable domain records use `@DeleteDateColumn` + `softRemove`/`softDelete`. Never physically delete mutable domain records unless the table is a documented lifecycle/log/join exception.                                                 | semantic              | medium   | docs/database-standards.md            |
| **STD-08** | Never `synchronize: true` in TypeORM config. Schema changes go through migrations.                                                                                                                                                               | mechanical            | high     | docs/database-standards.md / ADR-0012 |
| **STD-10** | Multi-write operations are wrapped in `@Transactional()`; the class injects `TransactionHost<TransactionalAdapterTypeOrm>` and performs all DB access via `this.txHost.tx` (never repositories/data sources that bypass the active transaction). | semantic              | medium   | docs/database-standards.md / ADR-0008 |
| **STD-12** | No `@Column({ type: 'enum', ... })` on any entity. Enum-like columns are `varchar` + a TS enum; migration `CHECK` constraints are the intended hardening pattern, with current drift documented in `docs/database-standards.md`.                 | mechanical            | high     | docs/database-standards.md / ADR-0009 |
| **STD-13** | No `eager: true` on `@ManyToOne`/`@OneToMany`/`@ManyToMany`. Relations are always loaded explicitly (`relations:`/`leftJoinAndSelect`).                                                                                                          | mechanical            | medium   | docs/database-standards.md            |
| **STD-14** | Every `@ManyToOne` sets `onDelete` explicitly (`CASCADE`/`SET NULL`/`RESTRICT` per ownership — never the TypeORM default).                                                                                                                       | mechanical            | low      | docs/database-standards.md            |

## DTO & Query

| id         | rule                                                                                                                                                                                                                                                                          | type     | severity | source                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ----------------------------------------------------- |
| **STD-07** | Update DTOs use `PartialType(CreateDto)`. List/filter DTOs extend `PaginationFilterDto` or `SortableFilterDto` (don't redefine `page`/`limit`/`getAll`). Sortable services use `resolveSortField` with a resource-specific `VALID_SORT_FIELDS` allowlist before `.orderBy()`. | semantic | medium   | §14 / ADR-0010 / docs/pagination-filtering-sorting.md |
| **SEC-09** | Controllers do not accept raw unvalidated objects for HTTP body/query/params unless the endpoint is explicitly opaque and has a narrow parser; dynamic query fields are allowlisted before use.                                                                               | semantic | medium   | docs/security-standards.md / ADR-0010                 |

## Security

| id         | rule                                                                                                                                                                                                           | type                  | severity | source                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------- | ------------------------------------- |
| **STD-04** | Sensitive columns (passwords, secrets) carry `@Exclude()` and `{ select: false }`.                                                                                                                             | semantic              | high     | docs/security-standards.md            |
| **SEC-01** | Passwords are hashed via `PasswordHashUtil`, never hand-rolled `bcrypt`/`bcryptjs` calls in services.                                                                                                          | semantic              | high     | docs/security-standards.md            |
| **SEC-02** | Never log passwords, JWTs, refresh tokens, OTPs, API keys, provider secrets, authorization headers, cookies, or full request bodies.                                                                           | semantic              | high     | docs/security-standards.md            |
| **SEC-04** | Store the S3 **key** in the DB; never a presigned URL. Resolve URLs at response time with `@ResolvePresignedUrls`.                                                                                             | semantic              | medium   | docs/security-standards.md            |
| **SEC-05** | `@Public()` endpoints are limited to justified pre-auth/health flows; admin endpoints use permission guards and app endpoints use subject guards plus `@CurrentUser()` targeting.                              | semantic              | high     | docs/security-standards.md / ADR-0006 |
| **SEC-06** | Public auth/provider endpoints that consume credentials, OTPs, refresh tokens, registration sessions, reset tokens, or provider calls have stricter route-level `@Throttle()` limits than the global baseline. | semantic              | medium   | docs/security-standards.md            |
| **SEC-07** | Audit diffs and logs redact sensitive keys such as password/token/OTP/secret/API key/authorization/cookie/provider credential fields and close variants.                                                       | semantic              | high     | docs/security-standards.md            |
| **SEC-08** | New secrets/config values have no production defaults, live in `env.validation.ts` and typed config wrappers, and provider toggles fail closed.                                                                | mechanical + semantic | high     | docs/security-standards.md / ADR-0014 |
| **STD-11** | New env vars are added to the Joi schema in `src/common/config/env.validation.ts`.                                                                                                                             | mechanical + semantic | low      | docs/security-standards.md / ADR-0014 |

## Operations & Quality

| id         | rule                                                                                                                                                                                                                                                                                       | type       | severity | source                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------- | ------------------------- |
| **STD-05** | No `console.log` in `src/` (seeders/tests excepted). Use `Logger` from `@nestjs/common`.                                                                                                                                                                                                   | mechanical | low      | ARCHITECTURE.md §20 / §23 |
| **STD-06** | Injected deps are `readonly`; service methods have explicit return types.                                                                                                                                                                                                                  | semantic   | low      | ARCHITECTURE.md §20       |
| **STD-09** | `@LogActivity` only on authenticated endpoints. `@Public()` endpoints emit `ActivityLogEvent`/`AuditLogEvent` from the service instead (no `request.user` pre-auth).                                                                                                                       | semantic   | medium   | ARCHITECTURE.md §11 / §21 |
| **STD-15** | A service that reads through `cacheManager.get`/`.set` for a resource also calls `cacheManager.del` (or overwrites the same key) in the corresponding write path — cache and DB must not silently diverge.                                                                                 | semantic   | medium   | ARCHITECTURE.md §20       |
| **STD-16** | `npm run typecheck`, `npm run build`, and `npm run knip` introduce no _new_ errors/findings versus the pre-change baseline (the repo has pre-existing knip findings not yet cleaned up — flag only findings the diff introduces, not the existing baseline).                               | mechanical | high     | ARCHITECTURE.md §23       |
| **SEC-03** | Emails are queued via `NotificationService`, never sent inline (no direct `nodemailer` call in a request path). SMS OTP send/verify is a deliberate synchronous exception (§13) — direct `SMSPohService` calls in `UserAuthService`/`PasswordResetService` are compliant, not a violation. | semantic   | medium   | ARCHITECTURE.md §13 / §20 |

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

# Build check (STD-16)
npm run build

# STD-16 — unused files/exports/dependencies (knip.json config). Repo has a pre-existing
# baseline of findings (see §23) — only new findings vs. the pre-change state count.
npm run knip

# STD-05 — console.log outside seeders/tests
grep -rnE "console\.(log|debug|info)" src --include="*.ts" | grep -vE "/seeders/|\.spec\.ts"

# STD-02 — unconditional unique column (review each hit: is the entity soft-deletable?)
grep -rnE "@Column\([^)]*unique:\s*true" src/modules --include="*.entity.ts"

# STD-08 — synchronize: true anywhere
grep -rnE "synchronize:\s*true" src --include="*.ts"

# STD-01 — entities not extending a sanctioned base (review each hit:
# ActivityLog, AuditLog, and RolePermission are current documented exceptions)
grep -rLE "extends (BaseEntity|SoftDeletableEntity)" src/modules/**/entities/*.entity.ts

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

# SEC-02 candidates — logging obviously sensitive values (review each hit)
grep -rnEi "logger\\.(log|warn|error|debug|verbose).*password|logger\\.(log|warn|error|debug|verbose).*token|logger\\.(log|warn|error|debug|verbose).*otp|logger\\.(log|warn|error|debug|verbose).*secret|logger\\.(log|warn|error|debug|verbose).*authorization|logger\\.(log|warn|error|debug|verbose).*cookie" src --include="*.ts"

# SEC-06 candidates — every public auth route should have route-specific throttling
grep -n "@Public()\\|@Throttle" src/api/v1/auth/auth.controller.ts

# STD-12 — native DB enum columns (should be varchar + TS enum; CHECK constraints are reviewed in migrations)
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
  source: ARCHITECTURE.md §4 Zone 2 / ADR-0004
  detail: Service injects @InjectRepository(ForeignEntity) owned by another module.
  fix:    Inject the owning module's service (e.g. UserService) and call its method instead.
```

End with a summary table (counts by category × severity) and the raw mechanical-tool output
(eslint/tsc) in a collapsed block. **Advisory only — propose fixes, never apply them.**

## Drift

Every rule cites its source (`ARCHITECTURE.md` / `docs/database-standards.md` /
`docs/security-standards.md` / `ADR-NNNN`). In `--audit` mode, do a final pass:
spot-check that each cited source still says what the rule claims. If an
authoritative doc has changed, flag the stale rule rather than enforcing it.
The source always wins.
