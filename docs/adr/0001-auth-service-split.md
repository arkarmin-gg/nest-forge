# ADR 0001: Split AuthService into purpose-cohesive services

**Status:** Accepted

## Context

`AuthService` grew to ~1,666 lines handling every auth-related concern: user login, admin login, Google/Apple OAuth, user multi-step registration, two separate password-reset flows (email + SMS), profile update for both user and admin, and token lifecycle management. It also directly held `userRepository` and `adminRepository`, bypassing the domain services that own those entities.

## Decision

Split `AuthService` into purpose-cohesive services:

- **`TokenService`** — refresh token generation, revocation, and access token refresh. No domain entity logic.
- **`UserAuthService`** — user login (phone/password, Google, Apple), multi-step registration, user logout, user profile update, user password flows.
- **`AdminAuthService`** — admin login, 2FA send/verify/login, admin logout, admin profile update, admin password flows.

`UserAuthService` and `AdminAuthService` call `UserService` and `AdminService` respectively for entity access rather than injecting repositories directly.

## Consequences

- Each service has a single, clearly stated responsibility.
- Future developers adding a new auth flow know exactly which file to open.
- Unit tests target one surface area per file.
- More files to navigate, but the boundary is self-evident from the name.
