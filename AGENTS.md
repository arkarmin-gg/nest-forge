# AGENTS.md — instructions for AI coding agents

Entry point for any AI agent (Codex, Cursor, Claude Code, …) working in **nest-forge**.

## Read these first

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — architecture & development standards (source of truth for _how_ code is written here).
- [`CONTEXT.md`](CONTEXT.md) — domain glossary.
- [`docs/adr/`](docs/adr/) — architecture decision records.

## Code review & architecture compliance

To review changes or audit the repo for architecture compliance, code standards, and
security, follow the rubric — it is tool-agnostic and the single source of truth:

> [`docs/review/ARCHITECTURE-COMPLIANCE.md`](docs/review/ARCHITECTURE-COMPLIANCE.md)

Procedure (identical regardless of tool):

1. **Pick the file set.**
   - _Diff_ (default): files changed since the merge-base with `main` —
     `git diff --name-only "$(git merge-base HEAD main)"...HEAD -- 'src/**/*.ts'`
   - _Audit_: the whole `src/` tree.
2. **Run the mechanical checks** in the rubric's _Mechanical command appendix_
   (`npx eslint` without `--fix`, `npx tsc --noEmit`, `npm run knip`, the greps). Capture the
   output; don't re-derive these by reading code.
3. **Reason over the semantic rules** in the rubric, scoped to the file set — the rules a
   linter can't catch (cross-module repo injection, business logic in controllers, wrong
   barrel imports, missing whitelist DTOs, etc.).
4. **Emit the report** in the rubric's _Report format_. **Advisory only — propose fixes,
   never apply them.**

(Claude Code users: the `/architecture-review` skill wraps this procedure.)

## When writing code

Follow `ARCHITECTURE.md`. The non-negotiables (§19) and common mistakes are exactly
what the rubric checks — read them before adding a module, controller, entity, or service.
