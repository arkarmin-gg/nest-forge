# Template Readiness Roadmap

> Goal: make `nest-forge` the standard backend template for the team and a reliable rule source for AI agents generating production-ready NestJS code.

This roadmap records the accepted documentation, standards, and feature decisions from the template-readiness grilling session. It is intentionally phased so the project can improve without turning the template into a giant rewrite.

## Guiding Principles

- The template is a production-oriented NestJS modular monolith starter.
- Human developers and AI agents are both first-class readers of the docs.
- Architecture rules must be machine-checkable where practical.
- Docs should define the paved road, not merely describe current code.
- New standards should be introduced with checklists, examples, and review rules.
- Provider-specific choices are allowed only where the project has chosen a default.

## Accepted Decisions

| Area | Decision |
| --- | --- |
| API contract | OpenAPI is the canonical API specification. |
| Testing | Testing pyramid is non-negotiable. |
| Local infrastructure | Docker Compose is part of the official local template. |
| Production deployment | VM + PM2 is the default production path. |
| Observability | Structured logs, metrics, error reporting guidance, and alerting are formal standards. |
| Security | Security baseline is OWASP API Security Top 10 aligned. |
| Database | Database evolution and migration safety get dedicated standards. |
| AI agents | AI agent rules live in a dedicated operating manual. |
| Module planning | Non-trivial modules require a written module specification. |
| Scaffolding | Extend `forge` into the official architecture scaffolding tool. |
| Configuration | Config and secrets management are first-class standards. |
| Jobs | Background jobs and scheduled work get their own standard. |
| Events | Domain events become a formal architectural standard. |
| Authorization | Every non-trivial module spec includes an authorization matrix. |
| Versioning | API versioning and backward compatibility are formally defined. |
| Errors | Stable application error codes and an error catalog are required. |
| Privacy | Privacy and compliance baseline is documented. |
| Uploads | Upload/media security gets a dedicated policy. |
| Lists | Pagination, filtering, and sorting rules are formal review criteria. |
| Releases | Release management and changelog rules are part of the template. |
| Dependencies | Dependency governance and supply-chain checks are required. |
| Git workflow | Git/PR workflow docs and templates are required. |
| Performance | Performance and scalability rules are formal standards. |
| Tenancy | Single-tenant by default; multi-tenancy requires a future ADR. |
| i18n | Optional; stable error codes are the client contract. |
| Admin ops | Include a small admin operations core, with optional extension modules. |
| Notifications | Email/SMS/push notification standards are documented. |
| Data lifecycle | Soft delete, restore, retention, and purge rules are documented. |
| Health | Health, readiness, liveness, and maintenance behavior are standardized. |
| Docs | Canonical docs structure and ownership rules are defined. |

## Phase 1: Documentation Foundation

Purpose: create the rulebook before implementing broad behavior changes.

### Add Core Standards Docs

- `docs/api/openapi.md`
  - OpenAPI as source of truth.
  - Swagger decorator requirements for controllers and DTOs.
  - API examples, tags, auth decorators, response documentation.
  - Generated `docs/api/openapi.json` drift policy.
  - Postman collection generation policy.
- `docs/testing.md`
  - Unit, integration, e2e, architecture, and contract test standards.
  - Required tests by change type.
  - Test data builder/factory conventions.
  - DB, Redis, BullMQ, auth helper strategies.
  - Coverage gates by layer.
- `docs/security.md`
  - OWASP API Security Top 10 mapping.
  - Auth/session/token lifecycle rules.
  - Endpoint-specific rate limit standards.
  - File upload security summary.
  - Dependency scanning and AI-generated code review checklist.
- `docs/database-standards.md`
  - Naming standards for tables, columns, indexes, FKs, checks.
  - Migration naming and review checklist.
  - Zero-downtime migration guidance.
  - Nullable/non-nullable rules.
  - Indexing strategy and pagination impact.
  - Seed data vs fixture data vs migration data.
- `docs/ai-agent-guide.md`
  - Required read order.
  - Before-coding checklist.
  - Change-type checklists.
  - Forbidden shortcuts.
  - Required tests and docs updates.
  - Final response expectations.
- `docs/configuration.md`
  - Environment tiers.
  - Required vs optional env vars.
  - Secrets placement and file permissions for VM production.
  - Drift rule: Joi schema, `.env.example`, and docs stay in sync.
- `docs/deployment-vm-pm2.md`
  - Ubuntu setup.
  - Node version pinning.
  - Build, migration, and PM2 startup flow.
  - Nginx, HTTPS, firewall, env file permissions.
  - Rollback and smoke test procedure.

### Add Supporting Standards Docs

- `docs/jobs-and-scheduling.md`
- `docs/domain-events.md`
- `docs/error-catalog.md`
- `docs/privacy-compliance.md`
- `docs/upload-media-security.md`
- `docs/pagination-filtering-sorting.md`
- `docs/release-management.md`
- `docs/dependency-governance.md`
- `docs/git-workflow.md`
- `docs/performance-scalability.md`
- `docs/notifications.md`
- `docs/data-lifecycle-retention.md`
- `docs/health-readiness-maintenance.md`

### Add Templates

- `docs/templates/module-spec.md`
  - Domain vocabulary.
  - Actors/subjects.
  - Use cases.
  - API endpoints.
  - DTO and validation rules.
  - Entity model.
  - State machines.
  - Authorization matrix.
  - Events emitted/consumed.
  - Logging/audit requirements.
  - Transaction boundaries.
  - Error cases.
  - Tests required.
  - OpenAPI impact.
  - Migration impact.
  - Rollout/backward compatibility notes.
- `docs/templates/adr.md`
- `docs/templates/pr-checklist.md`
- `docs/templates/runbook.md`

### Update Existing Docs

- Update `README.md` to point to the canonical docs map.
- Keep `AGENTS.md` short and link to `docs/ai-agent-guide.md`.
- Update `ARCHITECTURE.md` with short summaries and links, not every detailed rule.
- Update `docs/review/ARCHITECTURE-COMPLIANCE.md` with new review categories after the dedicated docs exist.

## Phase 2: API Contract and Error Standardization

Purpose: make the HTTP surface explicit, stable, and machine-readable.

### OpenAPI Implementation

- Add `@nestjs/swagger`.
- Configure Swagger in `main.ts`.
- Protect or disable Swagger UI in production by default.
- Add script to generate `docs/api/openapi.json`.
- Add CI drift check for generated OpenAPI.
- Add standards for `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse`, and DTO `@ApiProperty`.
- Decide whether Postman collection is generated from OpenAPI or kept as a secondary artifact.

### Error Catalog Implementation

- Add stable machine-readable error codes.
- Standardize error response shape.
- Add per-module error code naming conventions.
- Map domain errors to HTTP statuses.
- Add tests for common auth, validation, DB, and RBAC errors.

## Phase 3: Test Infrastructure

Purpose: make the non-negotiable testing standard practical.

- Create test helper layout.
- Add auth helpers for `ADMIN` and `USER`.
- Add DB test setup strategy.
- Add Redis/BullMQ test strategy.
- Add test data builders.
- Add e2e coverage for core flows:
  - auth login/refresh/logout
  - user registration
  - password reset
  - admin CRUD
  - role/permission enforcement
  - app `/me`
  - settings
  - logs
- Add OpenAPI contract tests.
- Add coverage thresholds after baseline is measured.

## Phase 4: Local and Production Operations

Purpose: make setup and deployment predictable.

### Local Infrastructure

- Add `docker-compose.yml` with:
  - PostgreSQL
  - Redis
  - Mailpit
  - MinIO
- Align `.env.example` with compose defaults.
- Add scripts:
  - `infra:up`
  - `infra:down`
  - `infra:reset`
- Add local setup troubleshooting docs.

### VM + PM2 Production

- Add `ecosystem.config.js` or equivalent PM2 config.
- Add production log guidance:
  - stdout/stderr preferred for centralized logging
  - PM2 log rotation configured for VM deployments
- Add deployment checklist.
- Add rollback checklist.
- Add backup and restore runbooks.

## Phase 5: Observability and Health

Purpose: make production behavior visible and actionable.

- Standardize production JSON logs.
- Add request access logging with:
  - request ID
  - method
  - path
  - status
  - latency
  - subject ID/type when available
- Add log redaction rules and tests.
- Add optional Sentry integration guide.
- Add Prometheus-style `/metrics`.
- Add BullMQ metrics.
- Add slow query logging guidance.
- Split health endpoints:
  - `/health/live`
  - `/health/ready`
  - `/health`
- Define maintenance mode behavior.
- Add alerting checklist.

## Phase 6: Security and Data Lifecycle

Purpose: harden the template against common production failures.

- Add OWASP checklist to review rubric.
- Add endpoint-specific throttling standards.
- Add refresh token rotation and reuse-detection decision.
- Add failed-login tracking and lockout policy.
- Add user status policy:
  - active
  - banned
  - suspended
- Add file upload security:
  - MIME allowlist
  - extension allowlist
  - size limits
  - server-side MIME sniffing
  - malware scan hook
  - orphan cleanup
- Add retention policies:
  - OTP records
  - refresh tokens
  - audit/activity logs
  - failed jobs
  - uploaded files
- Document restore as out of scope until a future ADR.

## Phase 7: Architecture Tooling

Purpose: make the desired architecture easy to create.

### Forge Scaffolding

- Add `forge module create <name>`.
- Generate:
  - `src/modules/<name>/<name>.module.ts`
  - `src/modules/<name>/entities/`
  - `src/modules/<name>/dto/`
  - `src/modules/<name>/services/`
  - `src/modules/<name>/index.ts`
  - `src/modules/<name>/api.ts`
  - optional `src/api/v1/admin/<name>/`
  - optional `src/api/v1/app/<name>/`
  - spec stub under `docs/specs/`
  - unit/e2e test stubs
- Print follow-up checklist:
  - register module
  - generate migration
  - add permissions
  - add OpenAPI decorators
  - add tests
  - update docs

### Review Automation

- Extend architecture review rubric with:
  - OpenAPI drift
  - testing requirements
  - security checklist
  - DB migration review
  - authorization matrix review
  - env var drift
  - dependency justification

## Phase 8: Workflow and Governance

Purpose: make team usage consistent.

- Add PR template.
- Add issue templates.
- Add module spec requirement for non-trivial work.
- Add conventional commit policy.
- Add changelog/release process.
- Add dependency addition checklist.
- Add template upgrade guide for downstream projects.
- Add AI-agent disclosure/checklist section to PRs if desired.

## Default Scope Decisions

### In Scope by Default

- Admin/user subject split.
- RBAC and ownership checks.
- OpenAPI-first HTTP contracts.
- VM + PM2 production deployment.
- Docker Compose local infrastructure.
- Postgres, Redis, BullMQ, S3-compatible storage, SMTP/SMS integrations.
- Single-tenant applications.

### Out of Scope Unless Future ADR Opts In

- Multi-tenancy.
- Backend i18n/localization.
- Microservice extraction.
- Event sourcing.
- CQRS as a default pattern.
- GraphQL.
- Kubernetes as the default deployment path.

## Recommended Implementation Order

1. Documentation structure and templates.
2. OpenAPI and error catalog.
3. Testing infrastructure.
4. Docker Compose local infrastructure.
5. VM + PM2 deployment docs and config.
6. Observability, metrics, and health split.
7. Security and lifecycle hardening.
8. Forge scaffolding.
9. Workflow templates and release governance.

## Definition of Done for This Roadmap

- Each accepted standard has a dedicated doc or a clearly linked section.
- `README.md`, `AGENTS.md`, and `ARCHITECTURE.md` point readers to the right docs.
- AI agents have a precise guide for planning, coding, testing, reviewing, and reporting.
- New modules can be specified using a template before code generation.
- API contracts are generated and checked.
- Tests are required by documented policy and supported by helpers.
- Local and production environments are reproducible.
- Review rubrics cover architecture, standards, security, database, testing, API, and AI-agent risks.
