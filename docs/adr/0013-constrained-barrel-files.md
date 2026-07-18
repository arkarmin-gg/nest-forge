# ADR-0013: Constrained barrel files as boundary contracts

## Status

Accepted

## Context

Barrel files can hide dependency edges, enlarge module-load work, and make
circular imports harder to reason about when they are used as generic
convenience aggregators. In a NestJS backend this is less about browser
tree-shaking and more about predictable startup, test isolation, and avoiding
service cycles through public re-export files.

At the same time, `nest-forge` is a modular monolith. Cross-module imports are
not just path choices; they express whether a caller is depending on another
module's public contract or on its internals. The existing architecture already
uses root `index.ts` and `public-api.ts` files to make that public surface explicit,
and ESLint blocks deep cross-module imports into module internals.

## Decision

Barrel files are allowed only when they represent an architectural boundary.
They are not allowed merely to shorten import paths.

Domain modules keep exactly two root barrels:

- `index.ts` is the module wiring and domain surface: module class, entities,
  events, provider guards, and domain types.
- `public-api.ts` is the callable public application surface: services, DTOs,
  route decorators, and controller-facing types. Despite the filename, it is
  not HTTP-only; other domain services may import another module's services
  from `public-api.ts`.

The two barrels have a strict no-overlap rule: each exported symbol has exactly
one canonical public home. Controllers import from `public-api.ts`, never from
`index.ts`. Domain services import another module's services from `public-api.ts`, and
entities/events/domain types from `index.ts`. Domain services should not reuse
another module's HTTP DTOs unless that DTO has deliberately become a
cross-module service contract.

All barrel files follow the same hygiene rules:

- side-effect free: export declarations only, no runtime initialization
- named exports only; no `export *`
- `export type` for type-only exports
- own-module code uses relative direct imports, never its own root barrel

Nested barrels inside domain modules are not allowed. `enums/`, `interfaces/`,
`constants/`, `dto/`, `services/`, and similar implementation folders import
by direct relative file path. The root `index.ts`/`public-api.ts` files remain the
only module boundary barrels.

`common/` is a technical shared layer, not a domain boundary. It may keep
subfolder barrels such as `src/common/utils` and `src/common/dto`, but those
barrels must follow the same hygiene rules. A single `src/common/index.ts`
mega-barrel is not allowed.

Low-level database and operational code gets a narrow exception:
`src/seeders/**`, `src/data-source.ts`, and
`src/infrastructure/database/migrations/**` may direct-import concrete entity
and seeder files. They should not import arbitrary services/controllers as a
convenience escape hatch.

## Alternatives considered

- **Ban all barrel files.** Rejected: this removes a useful public contract in
  a modular monolith and would push boundary enforcement into many direct path
  rules instead of one explicit import surface.
- **Use a single root barrel per module.** Rejected: controllers, application
  services, module wiring, entities, and events have different audiences.
  Keeping `index.ts` and `public-api.ts` separate prevents accidental leakage between
  those surfaces.
- **Allow convenience barrels in subfolders.** Rejected for domain modules:
  nested barrels add indirection without expressing a module boundary, and make
  accidental public API growth harder to spot in review.
- **Keep the shorter `api.ts` filename.** Rejected after follow-up review:
  `api.ts` was easy to misread as HTTP-only, while the barrel is also used by
  domain services that call another module's public service. `public-api.ts`
  makes the boundary role explicit at the import site without changing the
  two-barrel architecture.
- **Use `contract.ts`.** Rejected: "contract" is too broad for a file that
  intentionally exports services, DTOs, route decorators, and controller-facing
  types.

## Consequences

**Benefits:**

- Cross-module imports continue to communicate architectural intent.
- Barrel-related performance risks are reduced by banning side effects,
  wildcard exports, and self-imports.
- Reviewers can treat every added public export as an explicit API decision.

**Costs / caveats:**

- A small amount of import ceremony remains: callers must choose `index.ts` or
  `public-api.ts` intentionally.
- Some existing imports need incremental cleanup or explicit exception
  classification, especially bootstrapping, seeding, and ambient type files.
- Full enforcement needs follow-up tooling beyond the current deep-import and
  cycle lint rules, especially for no-overlap and barrel-hygiene checks.
