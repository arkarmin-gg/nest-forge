# ADR 0003: Dedicated OTP module for verification code management

**Status:** Accepted

## Context

`CacheKey` was placed in `src/modules/auth/entities/` and injected directly into `AuthService`. It served multiple unrelated flows: admin password reset and user SMS password reset. The `CacheKeyService` enum (same name as an injectable service) encoded the purpose. Any new module needing OTP verification would have to import from `auth`, creating a wrong dependency direction.

## Decision

Create a dedicated `src/modules/otp/` module containing:

- `OtpRecord` entity (renamed from `CacheKey`) with `purpose: OtpPurpose` enum (`RESET_PASSWORD` | extendable)
- `OtpService` — manages creation, verification, expiry, and attempt counting for OTP records
- `OtpModule` exported so `AuthModule` and `PasswordResetService` import `OtpModule` instead of each injecting the repository directly

Rename `CacheKeyService` enum to `OtpPurpose` to eliminate the naming collision with NestJS's injectable service concept.

## Consequences

- Any future module needing OTP (email change, phone update) imports `OtpModule` — no cross-module entity borrowing.
- OTP lifecycle logic (expiry, attempts, status transitions) is consolidated in one place rather than duplicated across `AuthService`.
- `auth` module no longer owns a general-purpose infrastructure entity.
- Adds one new module directory; dependency graph becomes cleaner.
