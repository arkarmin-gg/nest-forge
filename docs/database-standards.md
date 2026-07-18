# Database & TypeORM Standards

> Canonical day-to-day rules for database work in `nest-forge`.
> `ARCHITECTURE.md` explains the wider architecture; ADRs explain why major
> decisions were made. This file is the implementation checklist.

## Source Of Truth

- TypeORM entities live in `src/modules/**/entities/*.entity.ts`.
- The TypeORM data source is `src/data-source.ts`.
- Migrations live in `src/infrastructure/database/migrations/`.
- The current template baseline migration is
  `src/infrastructure/database/migrations/1784213162334-init.ts`.
- The schema diagram source is `docs/database.dbml`.
- Database operations go through `npx forge db ...`; there is no sanctioned
  parallel `npm run migration:*`, `npm run db:*`, or raw `npm run typeorm`
  path.

When the standard and current implementation disagree, document the drift here
and fix it in a dedicated schema/code pass. Do not silently change database
behavior as part of a documentation cleanup.

## Entity Base Classes

Use `BaseEntity` for UUID primary keys and timestamps:

```typescript
// src/common/entities/base.entity.ts
export abstract class BaseEntity {
  @PrimaryColumn({
    type: 'uuid',
    default: () => 'gen_random_uuid()',
  })
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
```

Use `SoftDeletableEntity` for normal domain records that should be recoverable
and hidden from default TypeORM reads after deletion:

```typescript
// src/common/entities/soft-deletable.entity.ts
export abstract class SoftDeletableEntity extends BaseEntity {
  @Index()
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt?: Date;
}
```

Current usage:

- `SoftDeletableEntity`: `Admin`, `User`, `Role`, `Permission`,
  `ModuleEntity`, `Setting`.
- `BaseEntity`: lifecycle records that are not soft-deleted, such as
  `RefreshToken` and `OtpRecord`.
- Raw entity exceptions: high-volume append-only logs (`ActivityLog`,
  `AuditLog`) use integer primary keys and `createdAt` only; the
  `RolePermission` join table uses a composite primary key.

## Entity Rules

- Name tables explicitly with snake_case: `@Entity('table_name')`.
- Prefer `SoftDeletableEntity` for mutable domain records.
- Use `BaseEntity` for non-soft-deletable lifecycle records.
- Use a raw entity only when the table shape justifies it, such as an
  append-only high-volume log table or pure join table.
- Use `timestamptz` for date/time columns.
- Mark nullable columns explicitly with `nullable: true` and reflect that in
  the TypeScript type where practical.
- Sensitive fields use both `select: false` and `@Exclude()`.
- Entity relation files may direct-import related entity classes across module
  boundaries for TypeORM relationship wiring. Services must still respect
  module boundaries.

Example soft-deletable entity:

```typescript
import { SoftDeletableEntity } from 'src/common/entities';
import { Column, Entity, Index } from 'typeorm';

@Entity('articles')
@Index('UQ_articles_slug_active', ['slug'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Article extends SoftDeletableEntity {
  @Column()
  title!: string;

  @Column()
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
```

Example non-soft-deletable lifecycle entity:

```typescript
import { BaseEntity } from 'src/common/entities';
import { Column, Entity, Index } from 'typeorm';

@Entity('article_imports')
export class ArticleImport extends BaseEntity {
  @Index()
  @Column({ type: 'varchar' })
  status!: ArticleImportStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;
}
```

## Soft Delete And Uniqueness

Never put `unique: true` on a column in a soft-deletable entity. Soft-deleted
rows remain in the table, so an unconditional unique constraint keeps deleted
values reserved forever.

Use class-level partial unique indexes scoped to active rows:

```typescript
@Entity('users')
@Index('UQ_users_phone_active', ['phone'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class User extends SoftDeletableEntity {
  @Column()
  phone!: string;
}
```

Use the physical column name in the `where` clause (`"deleted_at" IS NULL`),
because the project uses `SnakeNamingStrategy`.

Service pre-checks should rely on TypeORM's default behavior of excluding
soft-deleted rows. Genuine active-row races are handled by the database partial
unique index and surfaced through the database exception filter.

## Enum-Like Columns

Do not use native Postgres enum types and do not use
`@Column({ type: 'enum', enum: ... })`.

The project standard is:

- TypeScript enum or `const ... as const` object is the application source of
  truth.
- DTOs validate values with `@IsEnum(...)` where values cross the API boundary.
- Entity columns use `varchar`, typed by the TypeScript enum.
- A migration should add or update a database `CHECK` constraint for the same
  value list.

```typescript
export enum OtpStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  USED = 'USED',
}

@Column({ type: 'varchar', default: OtpStatus.PENDING })
status!: OtpStatus;
```

When adding or renaming a value, update the TypeScript enum and create a
migration that drops and re-adds the corresponding `CHECK` constraint.

Current caveat: the current baseline migration uses `varchar` enum-like columns
but does not currently include all intended enum `CHECK` constraints. See
[Known Drift](#known-drift).

## Relationships

Every `@ManyToOne` must set `onDelete` explicitly:

| Relationship kind             | `onDelete` | Example                  |
| ----------------------------- | ---------- | ------------------------ |
| Owned child record            | `CASCADE`  | `RefreshToken` to `User` |
| Optional historical reference | `SET NULL` | `AuditLog` to `Admin`    |
| Protected reference data      | `RESTRICT` | `Admin` to `Role`        |

Do not use `eager: true`. Load relations explicitly at the call site so each
query owns its cost.

Use `relations: [...]` for simple lookups:

```typescript
return this.adminRepository.findOne({
  where: { id },
  relations: ['role'],
});
```

Use query builder for filtered, paginated, ordered, or multi-level relation
queries:

```typescript
const [items, total] = await this.adminRepository
  .createQueryBuilder('admin')
  .leftJoinAndSelect('admin.role', 'role')
  .skip(skip)
  .take(limit)
  .getManyAndCount();
```

Avoid N+1 query patterns, including loops that call another module's service
once per row. Add a batch service method when cross-module loading needs it.

## Repository Access

Same-module services may inject their own repositories:

```typescript
@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
  ) {}
}
```

Domain services must not inject another module's repository. Call the owning
module's exported service through `public-api.ts` instead. Entity files are the
exception: TypeORM relation metadata may import related entity classes directly.

Common/infrastructure services should avoid owning domain behavior. If a
technical service needs persisted settings, keep the query narrow and do not
move business decisions into `common/`.

## Transactions

Transactions use `@nestjs-cls/transactional` with the TypeORM adapter,
registered globally in `app.module.ts`.

Use `@Transactional()` when multiple writes must succeed or fail together.
Inside transactional methods, all database access must go through
`this.txHost.tx`; do not mix in injected repositories because they bypass the
active transaction.

```typescript
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';

@Injectable()
export class ArticlePublishingService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  @Transactional()
  async publish(articleId: string): Promise<Article> {
    await this.txHost.tx.update(Article, articleId, { status: 'PUBLISHED' });
    await this.txHost.tx.save(ArticlePublication, { articleId });

    return this.txHost.tx.findOneByOrFail(Article, { id: articleId });
  }
}
```

If code must run only after commit, use the wrapper pattern from `RoleService`:
a public non-transactional method awaits a private `@Transactional()` core, then
enqueues logs or jobs after the core resolves.

```typescript
async create(dto: CreateRoleDto, adminId: string, request: Request) {
  const role = await this.createInTransaction(dto);
  await this.logQueueService.enqueueAuditLog({ /* committed change */ });
  return role;
}

@Transactional()
private async createInTransaction(dto: CreateRoleDto) {
  // all DB access via this.txHost.tx
}
```

## Migrations

`synchronize` must stay `false` in TypeORM config. Schema changes go through
migrations.

Generate, review, and run migrations through `forge`:

```bash
npx forge db migrate generate AddArticleTable
npx forge db migrate run
npx forge db migrate status
npx forge db migrate revert
```

Production operations use the compiled build:

```bash
npx forge db migrate run --prod
npx forge db migrate status --prod
```

Destructive production operations prompt for confirmation:

```bash
npx forge db migrate revert --prod
npx forge db clear --prod
npx forge db reset --prod
```

Migration review checklist:

- The migration is in `src/infrastructure/database/migrations/`.
- The migration name describes the schema change.
- Generated SQL was reviewed for accidental `DROP COLUMN`, `DROP TABLE`, or
  constraint churn.
- New soft-deletable unique values use partial unique indexes.
- New enum-like values use `varchar` plus a `CHECK` constraint.
- New foreign keys have the intended `ON DELETE` behavior.
- Data backfills are safe to run more than once only when intentionally written
  that way.
- `down()` is reasonable for development rollback, and any irreversible
  behavior is called out in the migration comment.

## Seeding

Seed data lives in module-local seeders and is wired through `src/seeders/`.

Use seeds for template/runtime defaults such as roles, permissions, the default
superadmin, and SMTP settings. Do not use migrations for mutable application
defaults unless the data is required for schema correctness.

Run seeds through `forge`:

```bash
npx forge db seed
npx forge db reset
```

Production seed/reset commands require the same `--prod` discipline and
confirmation behavior as migrations.

## Query And Pagination Rules

- List endpoints use `PaginationFilterDto` or `SortableFilterDto`.
- Sortable services resolve sort fields through `resolveSortField(...)` and a
  resource-specific allowlist before calling `.orderBy()`.
- Use `skip`/`take` for current offset pagination.
- `getAll` is an explicit opt-out and should be reserved for small/admin
  datasets.
- Never hand-roll a second pagination shape.

## Database Errors

Use TypeORM repository/query-builder APIs for normal writes; they parameterize
queries. When raw SQL is necessary, pass parameters instead of interpolating
user input.

PostgreSQL exceptions are normalized by `DatabaseExceptionFilter`. In
particular, active-row unique collisions (`23505`) should surface as conflict
responses. Keep database constraints as the final integrity backstop rather
than relying only on service pre-checks.

## Known Drift

This pass is documentation-only. The following items describe current drift or
future hardening opportunities, not changes made by this document:

- `ARCHITECTURE.md` previously referenced an older baseline migration name
  (`1784000000000-CreateFoundationSchema.ts`). The current baseline is
  `1784213162334-init.ts`.
- ADR-0007 describes soft delete as living directly on `BaseEntity`; current
  code uses `SoftDeletableEntity extends BaseEntity`.
- ADR-0009 describes enum-like `varchar` columns with database `CHECK`
  constraints. Current entities use `varchar`, but the current baseline
  migration does not include all intended enum `CHECK` constraints.
- `refresh_tokens` and `otp_records` owner invariants are currently enforced by
  domain logic, not by database `CHECK` constraints.
- A future schema-hardening pass should add the missing checks if the project
  chooses to enforce those invariants at the database layer.
