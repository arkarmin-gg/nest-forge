# ADR-0010: `SortableFilterDto` + `resolveSortField` for client-controlled sorting

## Status

Accepted

## Context

Only the log module (`FilterAuditLogDto`, `FilterActivityLogDto`) previously
supported client-controlled `sortBy`/`sortOrder`. Each DTO duplicated the same
two fields inline, and each service (`audit-log.service.ts`,
`activity-log.service.ts`) duplicated the same allowlist check:

```ts
const orderField = VALID_SORT_FIELDS.includes(sortBy as keyof AuditLog)
  ? (sortBy as keyof AuditLog)
  : 'createdAt';
```

`user.service.ts`, `admin.service.ts`, and `role.service.ts` had no
client-controlled sort at all — order was pinned to `createdAt DESC` in the
query.

Extending sorting to Users, Admins, and Roles meant either copying the DTO
fields and the allowlist check three more times, or extracting the shared
shape. `sortBy` is a free-text query param that ends up in a query builder's
`.orderBy()` call, so an unguarded allowlist check is also a SQL-injection
concern worth solving once, not five times.

## Decision

- A generic `SortableFilterDto` (`src/common/dto/sortable-filter.dto.ts`)
  extends `PaginationFilterDto` and adds `sortBy?: string` and
  `sortOrder?: 'ASC' | 'DESC' = 'DESC'`. Resource filter DTOs that support
  sorting extend `SortableFilterDto` instead of `PaginationFilterDto`
  directly.
- A shared `resolveSortField<T extends string>(sortBy, validFields, defaultField): T`
  helper (`src/common/utils/sort.util.ts`) centralizes the allowlist check.
  Each service still declares its own `VALID_SORT_FIELDS: (keyof Entity)[]`
  array, since sortable columns differ per entity, but the validation and
  fallback logic is written once.
- An unrecognized `sortBy` silently falls back to the resource's default sort
  field — it is not a validation error. This matches the log module's
  pre-existing behavior and keeps the endpoint forgiving of stale/invalid
  client-side sort state.
- `sortOrder` remains strictly `'ASC' | 'DESC'` (`@IsIn`, case-sensitive) —
  lowercase input is rejected by class-validator like any other DTO field,
  consistent with existing behavior.
- `docs/pagination-filtering-sorting.md` is the operational guide for list
  endpoint query conventions. ADR-0010 records the architectural decision;
  that guide records the day-to-day recipe, the currently sortable resources,
  and the rules for adding new sortable fields.

## Alternatives considered

- **Duplicate `sortBy`/`sortOrder` fields and allowlist checks per resource**
  (the log module's original pattern, copied 3 more times). Rejected: five
  copies of identical code with no shared source of truth: fixing a bug in
  the fallback logic would require finding and patching it in five places.
- **Add `sortBy`/`sortOrder` directly to `PaginationFilterDto`.** Rejected:
  would silently apply to every paginated resource, including ones with no
  sortable columns declared, and blurs the documented "don't redefine
  page/limit/getAll, only add resource-specific fields" convention for the
  base pagination DTO.
- **Throw `400 Bad Request` on an invalid `sortBy`.** Rejected for this pass:
  changes existing log-endpoint behavior and adds a stricter contract than
  currently in place; revisit if a consumer needs to detect typos in sort
  params.

## Consequences

**Benefits:**

- One definition of the sort DTO fields and one definition of the fallback
  logic, reused by Users, Admins, Roles, and the two log resources.
- Adding a new sortable field to an existing resource is a one-line change to
  that service's `VALID_SORT_FIELDS` array — no DTO or controller changes.
- Adding sorting to a brand-new resource is a three-step recipe (extend
  `SortableFilterDto`, declare `VALID_SORT_FIELDS`, call
  `resolveSortField`), documented in `docs/pagination-filtering-sorting.md`.

**Costs / caveats:**

- `resolveSortField`'s silent fallback means a client that mistypes `sortBy`
  gets no error — just the default order, which can be surprising to debug
  from the client side.
- The initial allowlist for Users/Admins/Roles is `createdAt` only in this
  rollout; `sortBy` is largely a placeholder for now (only `sortOrder`
  meaningfully changes behavior) until more fields are added per-resource.
