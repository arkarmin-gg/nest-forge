# AI Agent Guide

> Operating guide for AI coding agents working in `nest-forge`.
> This file turns the project standards into an implementation workflow. It does
> not replace the source documents.

## Source Of Truth

Read these before changing code:

1. `ARCHITECTURE.md` - project structure, module boundaries, request lifecycle,
   response rules, and quality gates.
2. `docs/database-standards.md` - TypeORM entities, repositories, migrations,
   soft delete, uniqueness, transactions, and database tooling.
3. `docs/security-standards.md` - authentication, authorization, data exposure,
   secrets, logging, input safety, and abuse controls.
4. `CONTEXT.md` - domain language. Use these terms in code and documentation.
5. `docs/adr/` - accepted decisions. Do not contradict an ADR silently.
6. `docs/review/ARCHITECTURE-COMPLIANCE.md` - review rubric and mechanical
   checks.

If this guide conflicts with those documents, the source document wins. Update
this guide only after the source document changes.

## Agent Working Contract

When implementing with an AI coding agent:

- Read the local code and standards before designing a change.
- Keep the modular monolith boundaries intact. New code must fit the four zones:
  `api/v1/`, `modules/`, `infrastructure/`, and `common/`.
- Prefer existing patterns over new abstractions. Copy a nearby compliant
  example first; generalize only when the repetition is real.
- Make controllers thin. Business decisions belong in domain services.
- Keep domain modules independent. A module owns its entities and repositories.
  Other modules call its exported service.
- Treat security as part of the design, not a final patch.
- Run targeted checks before declaring work done.
- If a requested implementation would violate an accepted standard, explain the
  conflict and propose the compliant alternative.

## Implementation Loop

Use this loop for every task:

1. Classify the change.
   - HTTP route or response shape: start in `src/api/v1/`.
   - Business rule or data access: start in `src/modules/<domain>/`.
   - Database schema: entity plus migration under `src/infrastructure/database/migrations/`.
   - Technical plumbing: use `src/infrastructure/` for app infrastructure, or
     `src/common/` for cross-cutting utilities.
2. Find the nearest existing example in the same zone and module.
3. Identify the owning module for every entity involved.
4. Decide the public contract:
   - controllers import services, DTOs, and route decorators from `public-api.ts`;
   - domain services import another module's services from `public-api.ts`;
   - domain services import another module's entities or events from `index.ts`;
   - implementation files inside a module use relative imports, not their own
     root barrels.
5. Implement the smallest coherent change.
6. Add or update tests for behavior that could regress.
7. Run the verification commands that match the risk.
8. Re-read the diff as a reviewer before finalizing.

## Zone Decisions

### `src/api/v1/` - HTTP Layer

Use this zone only for controllers and API-boundary response shaping.

Checklist:

- Route is under the correct audience zone:
  - `api/v1/admin/**` for back-office `ADMIN` endpoints.
  - `api/v1/app/**` for end-user `USER` endpoints.
  - `api/v1/auth/**` only for shared auth flows.
- Controller imports from module `public-api.ts`, not deep service or DTO paths.
- Controller calls a service and returns the result.
- No repository access, hashing, persistence decisions, loops over business
  rules, or cross-entity orchestration.
- Admin endpoints use `PermissionsGuard` and `@RequirePermissions(...)`.
- App endpoints use `SubjectGuard`, `@RequireSubject(SubjectType.USER)`, and
  `@CurrentUser()` targeting.
- App endpoints never accept a user `:id` path param for self-service resources.
- App responses use whitelist DTOs with
  `plainToInstance(Dto, value, { excludeExtraneousValues: true })`.

Bad:

```ts
@Get(':id')
async findMe(@Param('id') id: string) {
  return this.userRepository.findOneBy({ id });
}
```

Good:

```ts
@Get('me')
async findMe(@CurrentUser() user: AuthenticatedUser) {
  const profile = await this.userService.findById(user.id);
  return plainToInstance(UserAppResponseDto, profile, {
    excludeExtraneousValues: true,
  });
}
```

### `src/modules/` - Domain Layer

Use this zone for business rules, entities, DTOs, services, domain events, and
module-owned persistence.

Checklist:

- The module accesses only its own repositories.
- Cross-module reads or writes go through the owning module's exported service.
- Services have explicit return types.
- Injected dependencies are `private readonly` or `readonly`.
- Multi-write operations use `@Transactional()` and `this.txHost.tx`.
- Events are used for decoupled cross-module side effects where appropriate.
- `index.ts` and `public-api.ts` remain named-export, side-effect-free boundary
  contracts with no symbol exported from both.
- No nested domain barrels such as `dto/index.ts` or `services/index.ts`.

Bad:

```ts
constructor(
  @InjectRepository(User)
  private readonly userRepository: Repository<User>,
) {}
```

Good:

```ts
constructor(private readonly userService: UserService) {}
```

### `src/infrastructure/` - Technical Plumbing

Use this zone for technical capabilities such as database migrations, health
checks, queues, and notification processing.

Checklist:

- No product business rules live here.
- Queue processors delegate domain decisions to services.
- Migrations are explicit and reviewed.
- Database operations use `npx forge db ...`; do not add parallel npm scripts.

### `src/common/` - Shared Cross-Cutting Code

Use this zone for reusable technical helpers, decorators, filters,
interceptors, DTO bases, validators, pipes, and low-level services.

Checklist:

- Code is genuinely cross-cutting and domain-agnostic.
- No module-specific business language is hidden in `common/`.
- Common barrels are limited to subfolders such as `common/utils` or
  `common/dto`; never create `src/common/index.ts`.

## Entity And Database Rules

Before changing an entity:

- Use `SoftDeletableEntity` for normal mutable domain records.
- Use `BaseEntity` for lifecycle records.
- Use raw entity shapes only for documented append-only log tables or pure join
  tables.
- Name tables explicitly in snake_case.
- Use `timestamptz` for date/time columns.
- Mark sensitive fields with both `select: false` and `@Exclude()`.
- Do not use `@Column({ unique: true })` on soft-deletable entities. Use a
  partial unique index scoped to `"deleted_at" IS NULL`.
- Do not use native enum columns. Use TypeScript enum plus `varchar`, and add a
  migration `CHECK` constraint when changing allowed values.
- Every `@ManyToOne` sets `onDelete` explicitly.
- Never use `eager: true`.
- Schema changes go through migrations. Never enable `synchronize: true`.

Migration flow:

```bash
npx forge db migrate generate AddExampleTable
npx forge db migrate run
```

Use `--prod` only against a deliberately built `dist/` artifact and follow the
confirmation rules in `docs/database-standards.md`.

## Security Rules

Before adding or changing an endpoint:

- Assume routes are authenticated by default. Use `@Public()` only for justified
  pre-auth or health/readiness flows.
- Public auth routes that consume credentials, OTPs, refresh tokens,
  registration sessions, reset tokens, or provider calls need route-level
  throttling stricter than the global baseline.
- Never trust raw request bodies, queries, params, file names, MIME types, or
  metadata. Use DTOs and allowlists.
- Never log passwords, JWTs, refresh tokens, OTPs, API keys, provider secrets,
  authorization headers, cookies, or full request bodies.
- Hash passwords through `PasswordHashUtil`, not direct `bcrypt` calls in
  services.
- Store refresh tokens and OTPs as hashes or provider references, never reusable
  plaintext credentials.
- Store S3 keys in the database, never presigned URLs. Resolve URLs at response
  time with `@ResolvePresignedUrls`.
- Add every new app env var to `src/common/config/env.validation.ts`,
  `.env.example`, and a typed config wrapper. Secrets must not have production
  defaults.

## DTO And Query Rules

- Create DTOs for every HTTP body, query, and param shape.
- Update DTOs use `PartialType(CreateDto)`.
- List/filter DTOs extend `PaginationFilterDto` or `SortableFilterDto`.
- Client-controlled sorting uses `resolveSortField` and a resource-specific
  `VALID_SORT_FIELDS` allowlist before `.orderBy()`.
- Do not accept raw `Record<string, unknown>` from a controller unless the
  endpoint is intentionally opaque and has a narrow parser.

## Logging And Side Effects

- Use Nest `Logger`; do not add `console.log` in `src/`.
- Use `@LogActivity()` only on authenticated endpoints where `request.user`
  exists.
- For `@Public()` auth flows and failure cases, emit `ActivityLogEvent` or
  `AuditLogEvent` from the service.
- Emails are queued through `NotificationService`; do not send inline in a
  request path.
- SMS OTP calls in the documented auth/password-reset path are the intentional
  synchronous exception.

## Anti-Slop Rules

Reject or revise code that has any of these traits:

- It works by bypassing module boundaries.
- It creates a generic helper without a second real caller.
- It duplicates an existing project pattern instead of reusing the local one.
- It moves business language into `common/` or `infrastructure/`.
- It adds a controller method that performs business logic.
- It returns raw app-zone entities to end users.
- It accepts broad unvalidated input because it is faster to write.
- It stores or logs secrets, tokens, OTPs, passwords, presigned URLs, or full
  request payloads.
- It changes database behavior in a documentation or cleanup task.
- It edits unrelated files, reformats large areas, or fixes existing drift
  without being asked.
- It hides uncertainty. If the standard is unclear, name the ambiguity and
  choose the smallest reversible implementation.

## Verification

For code changes, run the smallest useful set first, then broaden based on
risk:

```bash
npm run lint:check
npm run typecheck
npm run build
npm test
```

For architecture or security-sensitive changes, also use the mechanical command
appendix in `docs/review/ARCHITECTURE-COMPLIANCE.md`. That rubric is the review
source of truth.

For database changes, run migration generation or migration execution commands
through `npx forge db ...` and inspect the generated migration manually.

## Final Self-Review

Before handing work back:

- Re-read the changed files.
- Check imports against the barrel rules.
- Check controllers for accidental logic.
- Check services for cross-module repository access.
- Check app-zone responses for whitelist DTO mapping.
- Check new env vars, entities, migrations, and logs against the standards.
- Report which commands ran and any commands that could not be run.
