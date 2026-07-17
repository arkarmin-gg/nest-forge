# Pagination, Filtering, and Sorting

This document describes the conventions used across nest-forge list endpoints
for pagination, filtering, and sorting query parameters.

## Pagination

Every paginated list endpoint accepts a filter DTO extending
`PaginationFilterDto` (`src/common/dto/pagination-filter.dto.ts`):

| Field     | Type    | Default | Description                                             |
| --------- | ------- | ------- | --------------------------------------------------------|
| `page`    | number  | `1`     | 1-indexed page number.                                   |
| `limit`   | number  | `10`    | Page size.                                                |
| `getAll`  | boolean | `false` | When `true`, bypasses pagination and returns all matches. |

Do not redefine `page`/`limit`/`getAll` in a subclass — extend
`PaginationFilterDto` (or `SortableFilterDto`, below) and add only the fields
specific to that resource.

## Sorting

Resources that support client-controlled sorting extend `SortableFilterDto`
(`src/common/dto/sortable-filter.dto.ts`), which itself extends
`PaginationFilterDto`:

| Field        | Type              | Default | Description                                  |
| ------------ | ----------------- | ------- | --------------------------------------------- |
| `sortBy`     | string (optional) | —       | Field to sort by. Validated against a per-resource allowlist. |
| `sortOrder`  | `'ASC' \| 'DESC'`  | `DESC`  | Sort direction.                                |

### Allowlisting sort fields

`sortBy` is a free-text query param, so it must never be interpolated directly
into a query builder's `.orderBy()` call — that's a SQL-injection surface.
Every service that accepts `sortBy` declares its own allowlist and resolves
the effective sort field with the shared `resolveSortField` helper
(`src/common/utils/sort.util.ts`):

```ts
const VALID_SORT_FIELDS: (keyof User)[] = ['createdAt'];

const orderField = resolveSortField(filter.sortBy, VALID_SORT_FIELDS, 'createdAt');

qb.orderBy(`user.${orderField}`, filter.sortOrder ?? 'DESC');
```

`resolveSortField(sortBy, validFields, defaultField)` returns `sortBy` if it's
present in `validFields`, otherwise it silently falls back to `defaultField`.
An invalid `sortBy` is never treated as a client error — it never surfaces a
400, it just falls back.

### Currently sortable resources

| Resource      | Endpoint                  | Allowed `sortBy` values | Default    |
| ------------- | -------------------------- | ----------------------- | ---------- |
| Users         | `GET /admin/users`         | `createdAt`              | `createdAt`|
| Admins        | `GET /admin/admins`        | `createdAt`              | `createdAt`|
| Roles         | `GET /admin/roles`         | `createdAt`              | `createdAt`|
| Audit logs    | `GET /admin/audit-logs`    | `createdAt`, `action`, `entityName` | `createdAt` |
| Activity logs | `GET /admin/activity-logs` | `createdAt`, `action`, `resourceType` | `createdAt` |

To add a new sortable field to an existing resource, add it to that service's
`VALID_SORT_FIELDS` array — no DTO or controller change is needed since
`sortBy` is already a generic string field on `SortableFilterDto`.

### Adding sorting to a new resource

1. Extend `SortableFilterDto` instead of `PaginationFilterDto` in the
   resource's filter DTO.
2. In the service, declare `VALID_SORT_FIELDS: (keyof Entity)[]` with the
   columns you want to expose for sorting.
3. Use `createQueryBuilder` (required once ordering/filtering/pagination are
   involved — see ARCHITECTURE.md) and call
   `resolveSortField(filter.sortBy, VALID_SORT_FIELDS, defaultField)` to get
   the safe order column, then `.orderBy(...)` with it.

## Filtering

Filter fields are resource-specific and added directly to the DTO (e.g.
`search`, `isBanned`, `startDate`/`endDate`). There is no shared filtering
convention beyond the pagination/sorting base classes described above.

### `search`

Where present, `search` is a free-text ILIKE match across a resource-specific
set of text columns, combined with `OR` and ANDed against every other active
filter — e.g. Users/Admins match `fullName`/`email`; audit logs match
`entityName`/`ipAddress`/`device`/`location`; activity logs match
`resourceType`/`ipAddress`/`device`/`location`. Because it's a multi-column
`OR` combined with other `AND` filters, `search` requires `createQueryBuilder`
rather than a plain `FindOptionsWhere` object.
