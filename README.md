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
npm run migration:run
npm run db:seed
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

Optional foundation integrations:

- Redis (also backs BullMQ queues): `REDIS_HOST`, `REDIS_PORT`
- S3-compatible storage: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `AWS_ENDPOINT`, `AWS_REGION`, `AWS_BUCKET_NAME`
- SMTP seed defaults: `SMTP_FROM_NAME`, `SMTP_USERNAME`,
  `SMTP_USER_PASSWORD`
- SMS provider: `SMS_POH_API_KEY`, `SMS_POH_API_SECRET_KEY`,
  `SMS_POH_BASE_API_URL`, `SMS_POH_API_BRAND`, `SMS_POH_API_SENDER_ID`
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
npm run migration:run   # run migrations
npm run db:seed         # seed roles, admin, user, settings
npm run db:clear        # truncate local database tables
```

## Template Notes

This repository is a starter-template reset. The migration history begins with a
single foundation baseline and is not intended to migrate an older application
database forward.

When adding a domain module, follow the module template and import rules in
[ARCHITECTURE.md](ARCHITECTURE.md). For reviews, use
[docs/review/ARCHITECTURE-COMPLIANCE.md](docs/review/ARCHITECTURE-COMPLIANCE.md).
