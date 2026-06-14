# Architecture Compliance Rubric

> **Source of truth** for automated code review of `nest-forge`. Tool-agnostic — any AI
> agent (Claude Code, Codex, Cursor, …) follows this file. The Claude skill
> (`.claude/skills/architecture-review/`) and root `AGENTS.md` are thin wrappers that
> point here.
>
> **Authoritative docs:** [`ARCHITECTURE.md`](../../ARCHITECTURE.md), [`CONTEXT.md`](../../CONTEXT.md),
> [`docs/adr/`](../adr/). When a rule and the cited source disagree, the source wins —
> see [Drift](#drift).

## How to use this rubric

1. **Pick the file set.**
   - *Diff mode* (default): files changed since the merge-base with `main`.
   - *Audit mode* (`--audit`): the whole `src/` tree.
2. **Run the mechanical checks first** — see the [Mechanical command appendix](#mechanical-command-appendix). Capture output; do not re-derive these by reading code.
3. **Reason over the `semantic` rules only**, scoped to the file set. Mechanical rules are already covered by step 2.
4. **Emit the report** — see [Report format](#report-format). Advisory only: never edit code.

Each rule: `id` · statement · **category** (Architecture / Standards / Security) · **type**
(`mechanical` = a command finds it; `semantic` = needs reasoning) · **severity** · **source**.

---

## Architecture

| id | rule | type | severity | source |
|----|------|------|----------|--------|
| **ARCH-01** | A domain service must not inject another module's repository (`@InjectRepository(ForeignEntity)`). Call that module's exported service instead. | semantic | high | §19 #2 / ADR-0004 |
| **ARCH-02** | Controllers contain zero business logic — no repository access, `save`, `bcrypt`, branching, or data transformation. They call a service and return. | semantic | high | §4 Zone 1 / §19 #1 |
| **ARCH-03** | Controllers import from a module's `api.ts` only — never `index.ts`, never a deep path (`/services/*`, `/dto/*`, `/entities/*`). | mechanical + semantic | high | §5 / §19 #3 |
| **ARCH-04** | Domain services import *services* from `api.ts` and *entities/events* from `index.ts`. No symbol from the wrong barrel. | semantic | medium | §5 |
| **ARCH-05** | Every domain module under `src/modules/` exposes both `index.ts` and `api.ts`, with no symbol exported from both. | mechanical | medium | §5 |
| **ARCH-06** | App-zone endpoints (`src/api/v1/app/**`) map the entity to a whitelist response DTO via `plainToInstance(Dto, x, { excludeExtraneousValues: true })` and derive the target from `@CurrentUser()` — never a `:id` path param. | semantic | high | §4 / §7 / ADR-0006 |
| **ARCH-07** | An endpoint restricted to one subject type uses `@UseGuards(SubjectGuard)` + `@RequireSubject('USER'\|'ADMIN')`. The whole `app/` zone is USER-only. | semantic | medium | §8 / ADR-0006 |

## Standards

| id | rule | type | severity | source |
|----|------|------|----------|--------|
| **STD-01** | Entities extend `BaseEntity`. Append-only log tables may extend `AuditEntity` or use a documented raw-entity exception (`activity-log`, `audit-log` — integer PK for volume). | mechanical | medium | §9 |
| **STD-02** | No `@Column({ unique: true })` on a soft-deletable entity. Scope uniqueness with a partial unique index `where: '"deletedAt" IS NULL'`. | mechanical | high | §9 / ADR-0007 |
| **STD-03** | Soft delete only (`@DeleteDateColumn` + `softRemove`). Never physically delete rows. | semantic | medium | §9 |
| **STD-04** | Sensitive columns (passwords, secrets) carry `@Exclude()` and `{ select: false }`. | semantic | high | §9 / §19 security |
| **STD-05** | No `console.log` in `src/` (seeders/tests excepted). Use `Logger` from `@nestjs/common`. | mechanical | low | §19 |
| **STD-06** | Injected deps are `readonly`; service methods have explicit return types. | semantic | low | §19 code quality |
| **STD-07** | Update DTOs use `PartialType(CreateDto)`; list/filter DTOs extend `PaginationFilterDto` (don't redefine `page`/`limit`/`getAll`). | semantic | low | §14 |
| **STD-08** | Never `synchronize: true` in TypeORM config. Schema changes go through migrations. | mechanical | high | §9 / §19 #5 |
| **STD-09** | `@LogActivity` only on authenticated endpoints. `@Public()` endpoints emit `ActivityLogEvent`/`AuditLogEvent` from the service instead (no `request.user` pre-auth). | semantic | medium | §11 / §20 |
| **STD-10** | Multi-write operations are wrapped in `@Transactional()`, and the class injects a `dataSource` (`@InjectDataSource()`). | semantic | medium | §15 |
| **STD-11** | New env vars are added to the Joi schema in `src/common/config/env.validation.ts`. | mechanical + semantic | low | §17 / §19 #8 |

## Security

| id | rule | type | severity | source |
|----|------|------|----------|--------|
| **SEC-01** | Passwords are hashed via `PasswordHashUtil`, never hand-rolled `bcrypt`/`bcryptjs` calls in services. | semantic | high | §19 security |
| **SEC-02** | Never log passwords, tokens, OTPs, or secrets (no logger/console call with such a value). | semantic | high | §19 security |
| **SEC-03** | Emails/SMS are queued via `NotificationService`, never sent inline (no direct `nodemailer`/SMS provider call in a request path). | semantic | medium | §13 / §19 #7 |
| **SEC-04** | Store the S3 **key** in the DB; never a presigned URL. Resolve URLs at response time with `@ResolvePresignedUrls`. | semantic | medium | §12 / §19 #6 |

---

## Mechanical command appendix

Run from the repo root. These are **read-only** (no `--fix`). Capture and report the output.

```bash
# Lint (boundary + style rules; eslint.config.mjs already blocks deep imports → ARCH-03)
npx eslint "{src,apps,libs,test}/**/*.ts"

# Type check
npx tsc --noEmit -p tsconfig.json

# STD-05 — console.log outside seeders/tests
grep -rnE "console\.(log|debug|info)" src --include="*.ts" | grep -vE "/seeders/|\.spec\.ts"

# STD-02 — unconditional unique column (review each hit: is the entity soft-deletable?)
grep -rnE "@Column\([^)]*unique:\s*true" src/modules --include="*.entity.ts"

# STD-08 — synchronize: true anywhere
grep -rnE "synchronize:\s*true" src --include="*.ts"

# STD-01 — entities not extending BaseEntity/AuditEntity (review each hit)
grep -rL "extends BaseEntity\|extends AuditEntity" src/modules/**/entities/*.entity.ts

# ARCH-05 — every module has both barrels (a module missing either is a violation)
for d in src/modules/*/; do
  [ -f "$d/index.ts" ] || echo "missing index.ts: $d"
  [ -f "$d/api.ts" ]   || echo "missing api.ts: $d"
done

# ARCH-01 candidates — @InjectRepository inside a service (review: is the entity from another module?)
grep -rn "@InjectRepository" src/modules/*/services --include="*.ts"

# SEC-01 candidates — raw bcrypt in a service (should be PasswordHashUtil)
grep -rnE "bcrypt(js)?\.(hash|compare)" src/modules --include="*.ts"
```

> ARCH-03 is enforced by ESLint's `no-restricted-imports` in `eslint.config.mjs`; treat any
> `no-restricted-imports` error as an ARCH-03 finding. The `grep` rules surface *candidates* —
> confirm each with reasoning before reporting (e.g. ARCH-01: only cross-module injections count;
> same-module `@InjectRepository` is fine).

## Report format

Group findings by severity (High → Medium → Low). Separate **Mechanical** and **Semantic**
findings. Each finding:

```
[ARCH-01] high · src/modules/auth/services/password-reset.service.ts:36
  rule:   A domain service must not inject another module's repository.
  source: ARCHITECTURE.md §19 #2 / ADR-0004
  detail: PasswordResetService injects User & Admin repositories from other modules.
  fix:    Inject UserService / AdminService and call findByPhone() / findByEmail() instead.
```

End with a summary table (counts by category × severity) and the raw mechanical-tool output
(eslint/tsc) in a collapsed block. **Advisory only — propose fixes, never apply them.**

## Drift

Every rule cites its source (`ARCHITECTURE.md §N` / `ADR-NNNN`). In `--audit` mode, do a final
pass: spot-check that each cited section still says what the rule claims. If `ARCHITECTURE.md` or
an ADR has changed, flag the stale rule rather than enforcing it. The source always wins.
