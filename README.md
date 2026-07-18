# nest-forge

A production-ready NestJS API foundation for modular monolith backends. It ships
with authentication, authorization, audit/activity logging, database migrations,
seeders, queues, file upload helpers, and a documented architecture standard.

## Features

- NestJS 11 + TypeScript.
- PostgreSQL + TypeORM with migrations-only schema management.
- Redis cache integration.
- BullMQ + Redis-backed email notification jobs.
- JWT access tokens and SHA-256 hashed refresh tokens.
- Admin email/password auth.
- User phone-first OTP registration and phone/password login.
- OAuth identity fields for Google and Apple login flows.
- Hierarchical RBAC with roles, permission modules, and actions.
- Activity and audit logging.
- SMTP settings stored in the database.
- S3-compatible upload and presigned URL helpers.
- Health endpoint with database and memory checks.
- Architecture compliance rubric for code review.

## Foundation Modules

- `auth` — login, registration, refresh tokens, password reset.
- `admin` — back-office operator CRUD.
- `user` — end-user CRUD plus `/api/v1/app/me`.
- `role` — roles, permissions, guards, RBAC seed data.
- `otp` — OTP records and verification state.
- `log` — activity and audit logs.
- `setting` — SMTP settings.

## Project Structure

```text
src/
├── api/v1/             # HTTP controllers only
│   ├── admin/          # ADMIN subject routes
│   ├── app/            # USER subject routes
│   └── auth/           # shared auth routes
├── common/             # cross-cutting technical utilities
├── infrastructure/     # health, database migrations, notifications
├── modules/            # domain modules
├── seeders/            # database seed commands
├── app.module.ts
├── data-source.ts
└── main.ts
```

Read [ARCHITECTURE.md](ARCHITECTURE.md), [CONTEXT.md](CONTEXT.md), and
[docs/adr](docs/adr) before adding modules.

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 14+
- Redis 6+

## Getting Started

```bash
npm install
cp .env.example .env
npx forge db migrate run
npx forge db seed
npm run start:dev
```

The API uses URI versioning and the global `api` prefix. The health endpoint is:

```text
GET /api/v1/health
```

## Environment

Required values:

- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`
- `SEED_SMTP_FROM_NAME`, `SEED_SMTP_USERNAME`

Optional foundation integrations:

- Redis (also backs BullMQ queues): `REDIS_HOST`, `REDIS_PORT`,
  `REDIS_PREFIX_KEY`
- S3-compatible storage: `S3_ENABLED`, `AWS_ACCESS_KEY_ID`,
  `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT`, `AWS_REGION`, `AWS_BUCKET_NAME`
- SMTP seed password: `SEED_SMTP_PASSWORD`
- SMS provider: `SMS_POH_API_KEY`, `SMS_POH_API_SECRET_KEY`,
  `SMS_POH_BASE_API_URL`, `SMS_POH_API_BRAND`, `SMS_POH_API_SENDER_ID`,
  `SMS_POH_ENABLED`
- Local OTP/SMS mocks: `OTP_MOCK_ENABLED`, `OTP_MOCK_CODE`,
  `SMS_MOCK_ENABLED`

## Scripts

```bash
npm run start:dev       # run in watch mode
npm run build           # compile
npm run lint            # eslint with --fix
npm run lint:check      # eslint without mutation
npm run typecheck       # tsc --noEmit
npm test                # unit tests
npm run test:e2e        # e2e tests
```

Before pushing, run the quality-gate checks: `npm run lint:check`,
`npm run typecheck`, `npm run build`, and the relevant tests.

## Database & Migrations

All database and migration operations go through the `forge` CLI — there is no
parallel `npm run migration:*` path.

```bash
npx forge db migrate generate AddArticleTable   # generate a migration
npx forge db migrate run                        # apply pending migrations
npx forge db seed                                # seed roles, admin, user, settings
npx forge db clear                               # truncate local database tables
```

Every `run`/`revert`/`status`/`seed`/`clear`/`reset` subcommand accepts `--prod`
to run against the compiled build (`dist/src/data-source.js`), and destructive
prod operations (`clear`, `reset`, `migrate revert --prod`) require typing
"yes" to confirm (or pass `-y`/`--yes` for CI). See
[ARCHITECTURE.md §18](ARCHITECTURE.md) for the full command reference.

## Template Notes

This repository is a starter-template reset. The migration history begins with a
single foundation baseline and is not intended to migrate an older application
database forward.

When adding a domain module, follow the module template and import rules in
[ARCHITECTURE.md](ARCHITECTURE.md). For reviews, use
[docs/review/ARCHITECTURE-COMPLIANCE.md](docs/review/ARCHITECTURE-COMPLIANCE.md).
