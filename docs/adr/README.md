# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records documenting significant architectural decisions made in the buoy sonification project.

## Format

ADRs follow the template:

- **Status**: Accepted | Deprecated | Superseded
- **Date**: Decision date
- **Deciders**: Who made the decision
- **Technical Story**: Context reference
- **Context and Problem Statement**: What problem are we solving?
- **Decision Drivers**: Key factors influencing the decision
- **Considered Options**: What alternatives were evaluated?
- **Decision Outcome**: What we chose and why
- **Implementation Notes**: Code examples and usage
- **Compliance**: How it aligns with project constitution
- **Links**: Related documentation

## Index

| ADR                                | Title                                                     | Status   | Date       |
| ---------------------------------- | --------------------------------------------------------- | -------- | ---------- |
| [001](./001-prisma-orm.md)         | Use Prisma ORM for Database Access                        | Accepted | 2025-11-14 |
| [002](./002-bullmq-job-queue.md)   | Use BullMQ for Background Job Processing                  | Accepted | 2025-11-14 |
| [003](./003-server-sent-events.md) | Use Server-Sent Events (SSE) for Real-Time Data Streaming | Accepted | 2025-11-14 |
| [004](./004-redis-pubsub.md)       | Use Redis Pub/Sub for Worker-to-Server Communication      | Accepted | 2024-11-16 |

## When to Create an ADR

Create an ADR when making decisions about:

- **Architecture patterns**: ORM choices, transport protocols, data flow
- **Infrastructure**: Database selection, queue systems, caching strategy
- **Security**: Authentication, authorization, data protection
- **Performance**: Caching, pagination, query optimization
- **Developer experience**: Tooling, testing approach, code organization

## Constitution Alignment

All ADRs must reference how they align with project constitution principles (see [constitution.md](../../.specify/memory/constitution.md)):

- 2.1 Type-Centric Contracts
- 2.2 Test-First Delivery
- 2.3 Observability as a Design Input
- 2.4 Simplicity & Decomposition
- 2.5 Performance Awareness
- 2.6 Explicit Error Semantics
- 2.7 Backwards Compatibility
- 2.8 Security & Data Integrity Baselines
- 2.9 Developer Experience Velocity
- 2.10 Sonification-Centric Data Modeling

## References

- [Project Constitution](../../.specify/memory/constitution.md)
- [Engineering Principles](../../.github/engineering-principles.md)
- [ADR Template](https://github.com/joelparkerhenderson/architecture-decision-record)
