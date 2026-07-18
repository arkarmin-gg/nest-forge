# ADR-0012: `forge` CLI as the sole database and migration tool

## Status

Accepted

## Context

The project had two parallel ways to run database and migration operations:

1. `cli/` — a purpose-built `forge db` command tree (`migrate generate/run/revert`, `seed/clear/reset`), enforcing the migrations output path and offering discoverable `--help` output.
2. A full duplicate set of `npm run` scripts (`migration:generate/run/revert`, `migration:run:prod`/`migration:revert:prod`, `migration:status`, `db:seed/clear/reset`, `db:seed:prod`/`db:clear:prod`/`db:reset:prod`, and a raw `typeorm` passthrough script), each independently wrapping the TypeORM CLI or a seeder script.

`forge` only covered dev-mode operations — there was no way to run `--prod` migrations, seed/clear against a compiled build, or check migration status through it. Anyone operating on a production database (or in CI) had no choice but to fall back to the npm scripts, so `forge` was never actually primary — it was a convenience wrapper for local dev sitting alongside the real (npm-script) tool. That split also meant every DB operation had to be documented and kept in sync twice (README.md's Scripts section, ARCHITECTURE.md §18's comparison table, and package.json itself).

The destructive prod scripts (`db:clear:prod`, `db:reset:prod`, `migration:revert:prod`) also had no confirmation step of any kind — a typo'd command target could wipe a production database with no prompt.

## Decision

`forge` is the only sanctioned tool for database and migration operations. All `migration:*`, `db:*`, and the raw `typeorm` npm scripts are deleted from `package.json`.

To reach parity, `forge` gains:

- A `--prod` flag on `migrate run`, `migrate revert`, `migrate status`, `db seed`, `db clear`, and `db reset` — routes to `dist/src/data-source.js` / `dist/src/seeders/*.js`, invoked with plain `node`/`node_modules/.bin/typeorm` (no `ts-node`), matching how the app itself runs in production (`node dist/main`). `forge` errors immediately, without attempting to build, if `dist/` isn't present yet.
- `migrate generate` never accepts `--prod` — migrations are always generated from TypeScript source against live entity metadata, never from a compiled snapshot.
- A confirmation gate on the destructive `--prod` operations (`migrate revert`, `clear`, `reset`): it prints the resolved `DB_HOST`/`DB_NAME` from `process.env` and requires typing `yes`, or passing `-y`/`--yes` to skip interactively (for CI).
- A `migrate status` subcommand (dev and prod), which previously only existed as a prod-only npm script (`migration:status`).

## Alternatives considered

- **Keep npm scripts as thin aliases that shell out to `forge`.** Rejected: still leaves two names for every operation to document and remember; the goal is one obvious entry point, not one canonical implementation behind two front doors.
- **Detect prod mode via `NODE_ENV` instead of an explicit `--prod` flag.** Rejected: migrations/seeds are frequently run manually from a local machine or a CI step where `NODE_ENV` may not reflect the intended target database. An explicit flag makes the target unambiguous at the call site.
- **`inquirer`/`prompts` library for the confirmation gate.** Rejected: a single yes/no gate on a handful of commands doesn't justify a new dependency; Node's built-in `readline` covers it in a few lines.
- **"Type the database name back" confirmation (Terraform/GitHub-delete style).** Rejected as disproportionate: DB clear/reset is a routine (if destructive) dev-ops action for reseeding environments, and CI needs a clean non-interactive path via `--yes` regardless — a lighter "type yes" gate matches the actual risk level.
- **Auto-run `npm run build` when `dist/` is missing for a `--prod` command.** Rejected: prod commands should run against a build the operator deliberately produced (e.g. the artifact CI/CD actually deployed), not one silently generated on the spot, which could mask a stale or accidental local build being applied to a production database.

## Consequences

**Benefits:**

- One documented, discoverable command surface (`forge db --help`) instead of two.
- Prod-destructive operations get a safety gate they never had before.
- README.md and ARCHITECTURE.md §18 only need to describe one tool.

**Costs / caveats:**

- Anyone with the old `npm run migration:*` / `db:*` commands memorized (or scripted elsewhere) must switch to the `forge db ...` equivalents; this repo has no CI/Docker/Husky references to those scripts, so the blast radius is limited to documentation and muscle memory.
- The confirmation prompt reads `DB_HOST`/`DB_NAME` directly from `process.env` rather than introspecting the resolved TypeORM connection — this is simpler and matches what `data-source.ts` itself uses, but won't reflect connection options set any other way (e.g. a full `DATABASE_URL`, which this project doesn't currently use).
