# ADR 0002: Verify OAuth provider tokens cryptographically

**Status:** Accepted

## Context

The original `userGoogleLogin` and `userAppleLogin` used `jwtService.decode()` to extract the provider sub and email from the ID token. `decode()` is a base64 decode — it does not verify the token signature. Any attacker could craft a fake Google or Apple ID token and authenticate as an arbitrary user.

## Decision

Replace `jwtService.decode()` with cryptographic verification for each provider:

- **Google:** Use `google-auth-library` (`OAuth2Client.verifyIdToken`) which validates the token signature against Google's public keys and checks the `aud` claim against the configured client ID.
- **Apple:** Use `apple-signin-auth` or equivalent which validates the token against Apple's public JWKS endpoint.

Both methods throw if verification fails, so no manual error branching is needed.

Additionally, extract a shared private `handleOAuthLogin(provider, providerId, email, name?, request)` method that both `userGoogleLogin` and `userAppleLogin` delegate to, eliminating structural duplication.

## Consequences

- Prevents token forgery attacks on OAuth login endpoints.
- Adds `google-auth-library` and an Apple ID token verification library as dependencies.
- Each provider's client ID must be added to environment variables and validated via Joi at startup.
- The shared handler reduces OAuth login code from ~2× duplication to one place.
