# ADR-0007: Partial unique indexes for soft-deletable entities

## Status

Accepted

## Current implementation note

This ADR was written before the base classes were split. Current code keeps
UUID/timestamps on `BaseEntity` and implements soft delete on
`SoftDeletableEntity extends BaseEntity`. The partial-unique-index decision is
unchanged: any soft-deletable entity with an active-row uniqueness rule uses a
partial unique index with `WHERE "deleted_at" IS NULL`.

## Context

Soft delete was originally implemented once, on `BaseEntity`, via TypeORM's `@DeleteDateColumn()` (`deletedAt`). Current soft-deletable domain entities — `User`, `Admin`, `Role`, `Permission`, `ModuleEntity`, `Setting` — now inherit it through `SoftDeletableEntity`. TypeORM **auto-excludes** soft-deleted rows from reads (`find`, query builder, the existence pre-checks in the create/register flows), so a deleted record is invisible to the application.

The database, however, enforced **unconditional** UNIQUE constraints on the identifying columns (`User.phone/googleId/appleId`, `Admin.email`, `Role.name`, `ModuleEntity.code`, `Setting.key`, `Permission(moduleId, action)`). Those constraints still count soft-deleted rows.

This split produced `duplicate key value violates unique constraint` in normal operation:

1. A `User` with phone `X` is soft-deleted — the row remains, `deletedAt` set.
2. Someone re-registers with phone `X`.
3. The pre-check `findOne({ where: { phone } })` finds nothing (TypeORM hides the deleted row), so the app proceeds.
4. `INSERT` hits the unconditional DB constraint and fails — a `500`-class surprise for what should be a valid action.

The application's intent (a deleted record is gone) and the database's enforcement (the value is still taken) disagreed.

## Decision

Scope uniqueness to **active (non-deleted) rows**: replace each unconditional UNIQUE constraint with a Postgres **partial unique index** carrying `WHERE "deleted_at" IS NULL`, on every soft-deletable entity.

The indexes are declared on the entities (named class-level `@Index(..., { unique: true, where: '"deleted_at" IS NULL' })`) so TypeORM stays in sync and migration generation does not re-introduce the old constraints.

No service logic changed:

- The create/register pre-checks were already soft-delete-unaware (they ignore deleted rows), which is exactly the "deleted values are reusable" behaviour this decision codifies.
- `DatabaseExceptionFilter` already maps Postgres `23505` → `409 Conflict`, so a genuine collision between two **active** rows (e.g. a race that slips past the pre-check) still surfaces cleanly, now backstopped by the partial index.

## Alternatives considered

- **Restore-on-reuse** — on reuse, undelete the original row instead of creating a new one. Rejected: resurrects old data and relations under a "deleted" account; surprising, and there is no restore path in the system today.
- **Block reuse forever** — keep unconditional constraints and make the pre-checks soft-delete-aware so a deleted value can never be reused. Rejected: not the desired template behavior; a freed phone/email should be reclaimable.
- **Mutate the unique column on delete** (e.g. append the id/timestamp to `email` when soft-deleting). Rejected: corrupts stored data, complicates auditing, and is easy to get wrong across entities.

## Consequences

**Benefits:**

- Database enforcement now matches application semantics — deleted values are reusable, active values stay unique.
- One uniform pattern across all soft-deletable entities; new such entities follow the same `@Index(... where ...)` convention.
- No service-logic or error-handling changes; the existing `409` mapping still covers active collisions.

**Costs / caveats:**

- If a **restore/recover** feature is added later, it must handle the case where a deleted row's unique value has since been claimed by an active row — undeleting it would violate the partial index. Restore is not implemented today, so this is deferred, not solved.
- Multiple soft-deleted rows may now share the same value (intended). Any future reporting that assumes uniqueness across _all_ rows (including deleted) must use the row id, not the natural key.
- The `down()` migration restores the original unconditional constraints; reverting will fail if duplicate values exist among non-deleted-plus-deleted rows at that time.
