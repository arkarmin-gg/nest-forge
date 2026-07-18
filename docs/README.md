# nest-forge Documentation Map

This is the canonical map for project documentation. Use it to find the
document that owns each kind of rule; avoid duplicating detailed standards in
multiple places.

## Start Here

| Need | Read |
| --- | --- |
| Project overview, setup, and scripts | [README.md](../README.md) |
| Architecture model and module boundaries | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| AI coding-agent workflow | [AI Agent Guide](ai-agent-guide.md) |
| Domain language | [CONTEXT.md](../CONTEXT.md) |
| Accepted architecture decisions | [ADRs](adr/) |

## Canonical Standards

| Area | Owning doc |
| --- | --- |
| Database, TypeORM, migrations, seeds, transactions | [Database & TypeORM Standards](database-standards.md) |
| Route auth, data exposure, secrets, logging redaction, abuse controls | [Security Standards](security-standards.md) |
| Pagination, filtering, and sorting conventions | [Pagination, Filtering, and Sorting](pagination-filtering-sorting.md) |
| Architecture compliance review rubric and mechanical checks | [Architecture Compliance Rubric](review/ARCHITECTURE-COMPLIANCE.md) |

## Reference Artifacts

| Artifact | Purpose |
| --- | --- |
| [database.dbml](database.dbml) | Schema diagram source |
| [postman_collection.json](postman_collection.json) | Postman collection |

## Ownership Rule

When a topic has a dedicated standards doc, that doc owns the detailed rules.
Other docs should provide a short summary and link here or to the owning doc.
If two docs conflict, use the dedicated standards doc or ADR as the source of
truth, then update the stale reference.
