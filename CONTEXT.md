# Context

Domain glossary for the NestJS TypeORM API Starter. Implementation details belong in code and ADRs — this file is a glossary only.

---

## Subject

A `Subject` is any entity that can authenticate with the system. There are two subject types:

- **User** — a mobile/end-user who registers via phone OTP and logs in with phone + password or OAuth (Google, Apple).
- **Admin** — a back-office operator who logs in with email + password and may have 2FA enabled.

The `subjectType` field on `JwtPayload` (`'USER' | 'ADMIN'`) discriminates between the two at the API boundary.

---

## AuthenticatedUser

The `AuthenticatedUser` is the decoded JWT payload attached to `request.user` after a successful authentication. It contains `id`, `subjectType`, and optionally `roleId`. It is not a database entity — it is a view of the JWT claims.

---

## UserRegistrationStage

A `User` progresses through a multi-step registration state machine before their account is active. The stages are:

- **`OTP_VERIFIED`** — the user has verified their phone number via OTP. No password yet.
- **`PASSWORD_SET`** — the user has set a password. Account setup (profile) not yet complete.
- **`COMPLETED`** — the user has finished all registration steps. This is the active, fully-registered state.

A user with `registrationStage = COMPLETED` is considered to already exist for the purpose of registration guards.

---

## OtpRecord (formerly CacheKey)

An `OtpRecord` is a short-lived verification record used to validate a one-time code. The code is stored as a **SHA-256 hash** (`codeHash`) — never in plaintext, mirroring how `RefreshToken` is stored. It also tracks an optional provider `requestId`, expiry time, attempt count, and current status.

**OtpPurpose** (formerly `CacheKeyService`) — the reason the OTP was issued:
- `TWO_FACTOR` — used to verify a 2FA login challenge.
- `RESET_PASSWORD` — used to authorize a password reset.

`OtpRecord` is owned by the `OtpModule`, not the `AuthModule`.

---

## ActivityLog vs AuditLog

- **ActivityLog** — records end-user actions (login, logout, profile update, registration). Append-only, high volume, integer PK. Owned by the `ActivityLogModule`.
- **AuditLog** — records admin actions with `oldValue`/`newValue` diff for compliance. Append-only, integer PK. Owned by the `ActivityLogModule`.

The distinction: `ActivityLog` is "what did the user do?"; `AuditLog` is "what did the admin change and what was the before/after?"

---

## Role and Permission

- **Role** — a named group of permissions assigned to an `Admin`. A role has a name and belongs to one or more `RolePermission` records.
- **Permission** — a specific action (`CREATE | READ | UPDATE | DELETE`) on a `Module`. Permissions are not assigned directly to admins — they are assigned to roles.
- **Module** — a named resource area (e.g. `ADMIN`, `SETTING`). Modules can have a parent module for hierarchical organization.

Authorization is role-based at the coarse level (`@Roles()`) and permission-based at the fine-grained level (`@Permissions()`). Both use OR semantics — any matching role or permission grants access.

---

## RefreshToken

A `RefreshToken` is a long-lived token stored as a **SHA-256 hash** in the database. The plaintext token is returned to the client once and never stored. A `RefreshToken` belongs to either a `User` or an `Admin` — never both, never neither.
