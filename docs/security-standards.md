# Security Standards

> Canonical security checklist for `nest-forge`.
> `ARCHITECTURE.md` explains where security controls fit in the system;
> this file defines the implementation rules reviewers enforce.

## Threat Priorities

Optimize security work in this order:

1. Broken authentication and authorization: missing guards, wrong subject type,
   privilege escalation, and cross-user access.
2. Sensitive data exposure: passwords, tokens, OTPs, secrets, presigned URLs,
   and excessive app-zone response fields.
3. Injection and unsafe input: DTO bypass, unsafe query construction, unsafe
   sorting, and unsafe file metadata handling.
4. Secret and configuration mistakes: weak JWT secrets, permissive production
   CORS, and provider toggles that do not fail closed.
5. Abuse and operational security: throttling, logging/redaction, error
   disclosure, dependency hygiene, and provider-call cost controls.

## Route Authorization

- Every route is authenticated by default through the global `JwtAuthGuard`.
- `@Public()` is an explicit opt-out. It is allowed only for pre-auth flows
  such as login, registration, OTP, password reset initiation/verification,
  token refresh, OAuth callbacks/login, and health/readiness endpoints where
  product requirements allow unauthenticated access.
- New public endpoints need a code-review justification.
- `api/v1/admin/**` endpoints must use `PermissionsGuard` with
  `@RequirePermissions(...)`, except shared auth endpoints.
- `api/v1/app/**` endpoints must use `SubjectGuard` with
  `@RequireSubject(SubjectType.USER)`.
- Self-service user routes derive the target from `@CurrentUser()` and must not
  accept a user `:id` path param.
- Throttling is not authorization. A throttled route still needs the correct
  authentication, subject, ownership, role, or permission check.

## Data Exposure

- Sensitive entity fields use both `@Column({ select: false })` and
  `@Exclude()`.
- App-zone responses use whitelist DTOs with `@Expose()` and
  `plainToInstance(Dto, value, { excludeExtraneousValues: true })`.
- Admin-zone responses may return entities only when sensitive fields are
  protected at the entity level.
- Auth and token responses are deliberately shaped result objects or DTOs.
  Never spread whole user/admin entities into token payload responses.
- Store S3 keys in the database. Never store presigned URLs.
- Resolve presigned URLs at response time with `@ResolvePresignedUrls`.

## Secrets And Configuration

- Every app env var is declared in `src/common/config/env.validation.ts`,
  represented in `.env.example` when that file exists, and exposed through a
  typed `*.config.ts` wrapper.
- Runtime code consumes namespaced config keys from `registerAs()` config
  objects. Raw `process.env` access is reserved for config factories,
  bootstrap/tooling boundaries, and code paths that cannot receive injected
  config.
- Secrets must never have production defaults.
- JWT access and refresh secrets must be distinct, 32+ characters, and
  non-placeholder values.
- Secrets must never be logged, returned, stored in audit diffs, or embedded in
  migrations/seed data.
- Provider toggles fail closed: when enabled, required credentials must be
  present; when disabled, code paths must not attempt provider calls.
- Local/test mock secrets are acceptable only when clearly scoped by env
  toggles.

## Input And Query Safety

- Every request body/query/param shape crossing HTTP uses a DTO with
  `class-validator`.
- Do not accept raw `Record<string, unknown>` or unvalidated controller inputs
  unless the endpoint intentionally accepts opaque payloads and has a narrow
  parser.
- Query sorting uses per-resource allowlists before `.orderBy()`.
- Pagination/filter DTOs extend the shared pagination/sort DTOs.
- Use TypeORM repository/query-builder parameters. Do not concatenate dynamic
  SQL strings from client input.
- File uploads require size limits, allowlisted MIME types, and service-level
  storage rules.
- Treat client-provided file names, MIME types, and metadata as untrusted even
  after Multer filtering.

## Passwords, Tokens, And OTPs

- Passwords are hashed through `PasswordHashUtil`; services must not call
  `bcrypt`/`bcryptjs` directly.
- Refresh tokens are stored as hashes, not raw token strings.
- OTP codes are stored as hashes or external provider request references, not
  reusable plaintext credentials.
- OTP flows enforce expiry, attempt limits, single-use transitions, and resend
  throttling/cooldowns.
- Auth and reset responses should avoid user enumeration. Do not reveal whether
  an email or phone exists unless product requirements explicitly accept that
  risk.

## Logging And Audit

- Logs are for diagnosis and audit, not payload capture.
- Never log passwords, JWTs, refresh tokens, OTPs, API keys, provider secrets,
  authorization headers, cookies, or full request bodies.
- Audit diffs redact sensitive keys including `password`, `token`,
  `refreshToken`, `otp`, `secret`, `apiKey`, `authorization`, `cookie`,
  provider credential fields, and close variants.
- Security-relevant events should be logged explicitly from services: login
  success/failure, password change/reset, logout/token revocation, admin
  role/permission changes, settings/provider credential changes, and denied
  sensitive operations where practical.
- Log enqueue failure must not fail the business operation.
- Error logs include request ID and safe domain context, not raw sensitive
  payloads.

## Abuse Controls

- Keep global throttling as the baseline.
- Public auth endpoints that consume credentials, OTPs, refresh tokens,
  registration sessions, reset tokens, or provider calls need stricter
  route-specific throttles.
- Provider calls that cost money or create external side effects must be behind
  validation and throttling.
- Public endpoints that send email/SMS or call OAuth providers should have
  stricter limits than ordinary authenticated reads.

## Error Disclosure

- Client-facing errors should be useful but not reveal secrets, stack traces,
  provider credentials, SQL details, token hashes, OTP codes, or raw upstream
  responses.
- Database constraint errors are mapped through filters instead of leaking raw
  driver messages.
- Log detailed internal context only after redaction.

## Dependency And Operations Hygiene

- Run the mechanical checks in
  `docs/review/ARCHITECTURE-COMPLIANCE.md` before merging security-sensitive
  changes.
- Treat dependency updates that touch auth, JWT, validation, upload, TypeORM,
  Redis, logging, or HTTP middleware as security-sensitive changes.
- Production CORS must use explicit origins. `*`, `all`, or `true` are local
  development only.
