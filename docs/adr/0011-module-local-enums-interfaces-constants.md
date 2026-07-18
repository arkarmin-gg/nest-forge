# ADR-0011: Split module-local `constants/` into `enums/`, `interfaces/`, `constants/`

## Status

Accepted

## Context

Every domain module that needed a TS enum (`otp`, `role`, `user`, `log`) put it
in a `constants/` folder, one enum per file (e.g.
`otp/constants/otp-status.enum.ts`). `constants/` never actually held a plain
constant in any of those modules — the folder name promised something broader
than what it contained.

`infrastructure/notification/constants/notification.constants.ts` was the one
place that *did* mix the two: an `EmailJobName` enum sat in the same file as
three unrelated queue-config constants (`EMAIL_NOTIFICATION_QUEUE`,
`EMAIL_NOTIFICATION_JOB_ATTEMPTS`, `EMAIL_NOTIFICATION_BACKOFF_DELAY_MS`).

Separately, several exported constants and interfaces lived inline next to
their one caller instead of in any shared folder: `SetMetadata` Reflector keys
declared next to their decorator (`PERMISSIONS_KEY` in
`permissions.decorator.ts`, `IS_PUBLIC_KEY` in `public.decorator.ts`, etc.),
event-name strings declared next to their event class (`ACTIVITY_LOG_EVENT` in
`activity-log.event.ts`), and a handful of exported interfaces declared next
to their one usage site (`PermissionRequirement` in `permissions.decorator.ts`,
`ParsedUserAgent` in `user-agent.util.ts`). A `RequiredSubjectType` union type
alias (`'USER' | 'ADMIN'`) played the same role as an enum but didn't fit
either category.

None of this broke anything, but it meant "what enums/interfaces/constants
does this module define" had no single answer — the information was scattered
across decorators, events, interceptors, and utils, discoverable only by
reading every file in the module.

## Decision

- Every module gets up to three flat folders, each with one symbol per file:
  `enums/*.enum.ts`, `interfaces/*.interface.ts`, `constants/*.constant.ts`. A
  module only gets the folders it has content for — no empty folders.
- All existing enums move from `constants/` to `enums/` (`otp`, `role`, `user`,
  `log`). `notification.constants.ts` splits: `EmailJobName` moves to
  `notification/enums/email-job-name.enum.ts`; the three queue-config
  constants stay together in `notification/constants/notification.constants.ts`
  (they're a single cohesive queue-registration concern, not one-per-file
  candidates).
- Reflector metadata keys and event-name constants move into `constants/`,
  one file per constant (`permissions-key.constant.ts`, `roles-key.constant.ts`,
  `is-public-key.constant.ts`, `check-ownership-key.constant.ts`,
  `subject-key.constant.ts`, `log-activity-key.constant.ts`,
  `activity-log-event.constant.ts`, `audit-log-event.constant.ts`,
  `forgot-password-code-requested-event.constant.ts`) — even though each is
  set by exactly one decorator/event and read by exactly one
  guard/listener. The one-file-per-constant granularity matches the existing
  one-enum-per-file convention and keeps a module's constants listable without
  reading every decorator.
- Only **exported** interfaces/consts move. File-private (non-exported)
  helpers — `RoleConfig`/`ModuleSeed` in `role.seeder.ts`,
  `HttpExceptionResponseObject`, `PostgresDriverError`, `SMTPConfig`, etc. —
  stay exactly where they are. They can't be imported by anything else even in
  principle, so moving them would be pure churn and would misleadingly signal
  they're meant for reuse.
- `RequiredSubjectType` (`'USER' | 'ADMIN'`) becomes an enum, `SubjectType`, in
  `auth/enums/subject-type.enum.ts` — a type alias doesn't fit any of the
  three folders, and an enum gains `@IsEnum()`-style validation support and a
  single canonical name (`SubjectType.USER`) over a bare string literal.
- No new barrel: `enums/`, `interfaces/`, `constants/` do **not** get their own
  `index.ts`. Files are imported by direct relative path
  (`from '../enums/log-status.enum'`), same as before the split. The
  module-root `public-api.ts` and optional `index.ts` remain the only real
  barrel boundaries (see §5's boundary-barrel rule) — adding a second layer of barrels here would be
  indirection with no consumer-facing benefit, since nothing outside the
  module imports these files directly anyway (the existing
  `no-restricted-imports` ESLint rule already blocks that).
- This does **not** change ADR-0009's decision (`varchar` + `CHECK` over
  native DB enums) — that's about database representation; this ADR is only
  about where the TS enum's *source file* lives.

## Alternatives considered

- **Leave enums in `constants/`, document as convention only.** Rejected:
  `constants/` already meant "enums" in four modules and "enums + config" in a
  fifth — writing down the existing inconsistency doesn't resolve it, and a
  new module would have no clear folder to copy from.
- **Restructure only new modules going forward, leave existing ones as-is.**
  Rejected: a documented convention half the codebase violates is worse than
  no convention — it teaches contributors to distrust the docs.
- **Keep Reflector keys and event names colocated with their decorator/event
  (idiomatic Nest pattern).** Considered, since separating a `SetMetadata` key
  from the one decorator that sets it does cost a small amount of
  local readability. Rejected in favor of full consistency: this template
  optimizes for "list a module's constants in one place" over "read one
  decorator file top to bottom."
- **Also relocate file-private interfaces/consts to shared folders for
  uniformity.** Rejected: they cannot be imported by anything else by
  definition (no `export`), so moving them has no reuse benefit and only adds
  diff noise.
- **Give `enums/`/`interfaces/`/`constants/` their own barrel `index.ts`.**
  Rejected: no code outside the owning module reaches these files directly
  (blocked by `no-restricted-imports`), and nothing inside the module needs an
  extra indirection layer over a direct relative import.

## Consequences

**Benefits:**

- A module's enums, reusable interfaces, and primitive constants are each
  answerable by listing one folder, not by reading every decorator, event,
  and interceptor file in the module.
- New modules have an unambiguous folder to put a new enum/interface/constant
  in, with a worked example (`log/`) covering all three.
- The one-symbol-per-file convention (already true for enums) now extends to
  constants and interfaces, keeping git history focused (a rename touches one
  file, not a shared multi-symbol file).

**Costs / caveats:**

- Splitting Reflector keys out of their decorator adds one extra file (and one
  extra import) per metadata key — a small tax on the common case of "add one
  new `@SetMetadata`-based decorator."
- `git blame`/history on a moved enum file resets unless `git mv` is used
  consistently (it was, for this migration) — future ad-hoc moves should do
  the same.
