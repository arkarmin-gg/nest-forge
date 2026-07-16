# Adopt @nestjs-cls/transactional for database transactions

Status: accepted

We replaced the hand-rolled transaction mechanism in `src/common/transaction/` (a `@Transactional()` decorator that wrapped methods in `dataSource.transaction()` and stashed the `EntityManager` in a Node `AsyncLocalStorage`, read back via `TransactionContext.getManager()`) with the maintained [`@nestjs-cls/transactional`](https://papooch.github.io/nestjs-cls/) library and its TypeORM adapter. Services now inject `TransactionHost<TransactionalAdapterTypeOrm>` and run all queries through `this.txHost.tx`; `@Transactional()` is imported from the library and the per-class `dataSource`-property contract is gone.

## Considered Options

- **Keep the custom decorator.** Zero dependencies and ~56 lines, but it was unmaintained, offered only REQUIRED propagation, required every transactional class to expose a `dataSource` property, and forced services to mix transactional writes (`manager.*`) with non-transactional reads (injected repositories) — a real bug, since reads couldn't see uncommitted rows in the same transaction (observed in `RoleService.create`).
- **`typeorm-transactional` package.** Popular, but it relies on monkey-patching the TypeORM `Repository`/`DataSource` at startup, which is more invasive and harder to reason about than the explicit `txHost.tx` accessor.
- **`@nestjs-cls/transactional` (chosen).** Maintained, adapter-based (no monkey-patching), supports propagation modes and nested transactions, and exposes a single `txHost.tx` EntityManager that transparently falls back to the default manager outside a transaction — letting reads and writes share one code path.

## Consequences

- Inside transactional services, **all** DB access must go through `this.txHost.tx`; mixing in `@InjectRepository(...)` would silently bypass the active transaction.
- The CLS plugin is registered globally in `app.module.ts` with no request-scoped middleware mounted — the plugin manages its own context for transactions only.
- We take on three new runtime dependencies (`nestjs-cls`, `@nestjs-cls/transactional`, `@nestjs-cls/transactional-adapter-typeorm`), trading the zero-dependency footprint for maintained behavior and correct read/write consistency.
