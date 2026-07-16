# ADR-0005: Split Log Write Paths for Authenticated vs Pre-Auth Endpoints

`ActivityLogInterceptor` bails early when `request.user` is null, which is always the case on `@Public()` endpoints (login, registration, SMS OTP verification, password reset). Modifying the interceptor to extract subject identity from the response would couple it to individual response shapes and still can't cover failure cases (the interceptor uses `tap()`, which only fires on success). We decided to use two write paths: the interceptor for all `@LogActivity()`-decorated authenticated endpoints, and service-level `EventEmitter2` event emission for pre-auth flows and failure cases. Both paths write to the same `activity_logs` and `audit_logs` tables via the existing `LogListener`.

## Considered Options

Modifying the interceptor to handle `@Public()` endpoints by extracting the user ID from the response was rejected: it requires per-endpoint knowledge of response shapes, still can't cover authentication failures (wrong password, OTP mismatch), and makes the interceptor fragile to response shape changes.
