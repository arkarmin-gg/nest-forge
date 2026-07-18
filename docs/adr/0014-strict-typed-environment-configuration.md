# ADR-0014: Strict Typed Environment Configuration

## Status

Accepted

## Context

The project previously relied on a flat Joi schema with `allowUnknown: true`.
Several variables consumed by seeders and services were not declared in the
schema, and a few values had ambiguous names or units. For example,
`JWT_EXPIRATION` was documented as milliseconds while the JWT module treats a
numeric `expiresIn` value as seconds.

This made configuration behave like ambient process state instead of an
explicit runtime contract. Typos, stale names, and partially configured
providers could survive startup and fail later in less obvious paths.

## Decision

Environment configuration is now a strict application contract.

- Every env var consumed by the Nest app must be declared in
  `src/common/config/env.validation.ts`, represented in `.env.example`, and
  documented in `ARCHITECTURE.md`.
- The Nest app validates the env-file contract with unknown variables rejected.
  Predefined shell variables such as `PATH` are not part of this strict check.
- Runtime code consumes namespaced `registerAs()` configuration keys such as
  `jwt.secret`, `redis.host`, and `seed.superAdmin.email`.
- Direct raw env access is limited to config factories, bootstrap/tooling
  boundaries, and code paths that cannot receive injected configuration.
- Provider configuration uses explicit toggles. Disabled providers may have
  empty credentials; enabled providers must provide a complete credential group.
- Seed-only defaults use `SEED_*` names.
- Time-based env vars include their unit in the name. JWT TTLs use seconds:
  `JWT_ACCESS_TOKEN_TTL_SECONDS` and `JWT_REFRESH_TOKEN_TTL_SECONDS`.

## Consequences

Startup fails earlier for typoed, stale, or incomplete env configuration.
Developers must refresh local `.env` files from `.env.example` when env names
change.

The TypeORM data source remains a tooling boundary: it validates only the
database env slice required for migrations instead of requiring unrelated app
configuration such as JWT, SMS, or S3 values.

## Migration Notes

- Rename `SUPER_ADMIN_EMAIL` to `SEED_SUPER_ADMIN_EMAIL`.
- Rename `SUPER_ADMIN_PASSWORD` to `SEED_SUPER_ADMIN_PASSWORD`.
- Rename `SMTP_FROM_NAME` to `SEED_SMTP_FROM_NAME`.
- Rename `SMTP_USERNAME` to `SEED_SMTP_USERNAME`.
- Rename `SMTP_USER_PASSWORD` to `SEED_SMTP_PASSWORD`.
- Rename `JWT_EXPIRATION` to `JWT_ACCESS_TOKEN_TTL_SECONDS`.
- Rename `JWT_REFRESH_EXPIRATION` to `JWT_REFRESH_TOKEN_TTL_SECONDS`.
- Rename `MOCK_OTP_CODE` to `OTP_MOCK_CODE`.
- Add `S3_ENABLED` and `SMS_POH_ENABLED`.
- Remove stale, unconsumed env vars rather than keeping them silently.
