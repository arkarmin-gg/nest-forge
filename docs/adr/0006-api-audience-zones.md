# ADR-0006: API Audience Zones and Secure-by-Default App Responses

## Status

Accepted

## Context

Every endpoint under `src/api/v1/*` was admin-facing — e.g. the user controller logs *"Admin created a user"* and is gated by `PermissionsGuard` + `@RequirePermissions`. The system has two subject types (see CONTEXT.md → Subject): **ADMIN** (back-office) and **USER** (mobile/web end-user). As the boilerplate grows, USER subjects need their own endpoints (profile, self-service), and those must not reuse the admin surface.

Two problems made a USER surface unsafe to add naively:

1. **No structural separation.** All controllers sat flat under `api/v1/` with no marker of audience. A USER endpoint added next to admin ones would be indistinguishable, and route ownership ambiguous.

2. **Leaky-by-default serialization.** The response pipeline is passive: services return raw TypeORM entities, the global `ClassSerializerInterceptor` strips only `@Exclude()` fields, and `ResponseInterceptor` wraps the rest. The default is therefore *expose-everything-minus-exclusions*. Acceptable for trusted admins; wrong for end-user clients, which should receive only the fields they need. A new entity column would silently leak to clients.

3. **No subject-type assertion.** The global `JwtAuthGuard` only proves a token is valid — an ADMIN token would pass a USER endpoint's auth check.

## Decision

### 1. Audience sub-zones in the api layer

Partition `src/api/v1/` by audience (extends ADR-0004's zone model):

```
src/api/v1/
├── admin/        ← ADMIN subject surface — routes /api/v1/admin/*
│   ├── admin/    (admins management)
│   ├── user/     (user management)
│   ├── role/
│   ├── setting/
│   └── log/
├── app/          ← USER subject surface — routes /api/v1/app/*
│   └── user/     (self-service /me)
└── auth/         ← shared, mostly @Public — login/register for both subjects
```

Existing admin controllers moved under `admin/` and their routes gained the `admin/` prefix (e.g. `/api/v1/users` → `/api/v1/admin/users`). `auth/` is left shared: its routes are largely `@Public()` and serve both subject types; it is split per-route only if that falls out naturally, not force-moved.

Domain modules under `src/modules/` are **not** moved — only the HTTP-layer controllers.

### 2. Explicit response DTOs (whitelist) for the app zone

App-zone controllers map entities to a dedicated response DTO and serialize with whitelist semantics:

```ts
plainToInstance(UserAppResponseDto, user, { excludeExtraneousValues: true })
```

Only `@Expose()`-decorated fields survive. A column added to the entity later never reaches the app surface unless explicitly added to the DTO — *secure by default*. The admin zone keeps the existing passive entity serialization (trusted, full-data).

### 3. Mapping happens at the controller (api boundary)

Domain services stay audience-agnostic and keep returning entities, so both zones reuse them. The audience-specific shaping lives in the api zone where the audience is known.

### 4. `@RequireSubject` guard for subject-type assertion

A new `SubjectGuard` + `@RequireSubject('USER' | 'ADMIN')` decorator (in `AuthModule`, mirroring `@RequirePermissions`/`PermissionsGuard`) asserts `request.user.subjectType`. App endpoints carry `@RequireSubject('USER')` and derive the target from `@CurrentUser()` — never a `:id` path param — so a user can only ever act on their own record.

## Alternatives considered

- **Serialization groups** (`@Expose({ groups: ['admin'] })` on entities, group chosen per zone). Rejected: still leaky-by-default (an untagged field is exposed), and it loads two audiences' concerns onto one entity.
- **Field-whitelist interceptor** (`@ExposeFields('id','name')`). Rejected: untyped — no compile-time guarantee a field exists or is shaped correctly.
- **Branch-by-guard in shared controllers** (one handler, behavior switches on subjectType). Rejected: mixes audiences in one handler; hardest to reason about and secure.
- **Separate USER passport strategy** (`jwt-user`). Rejected: heavier (two strategies) when tokens already carry `subjectType`.

## Consequences

**Benefits:**

- Audience is explicit in both the route and the file tree; no "default = admin" ambiguity.
- App responses cannot leak entity internals — adding a column is safe by default.
- `@RequireSubject` is declarative and reusable, symmetric with the permission model.
- Domain services remain shared and audience-agnostic.

**Costs:**

- Breaking change to admin routes (`/api/v1/users` → `/api/v1/admin/users`). Acceptable: no external consumers yet.
- App endpoints carry a small amount of mapping boilerplate (one DTO + `plainToInstance` per resource).
- Two response conventions now coexist (passive entities for admin, whitelist DTOs for app); documented in ARCHITECTURE.md.
