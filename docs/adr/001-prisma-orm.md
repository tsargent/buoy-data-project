# ADR 001: Use Prisma ORM for Database Access

**Status**: Accepted  
**Date**: 2025-11-14  
**Deciders**: Tyler Sargent  
**Technical Story**: Phase 1 database layer selection

## Context and Problem Statement

We need a database access layer for the buoy sonification project that handles PostgreSQL interactions. The solution must provide type safety, migrations, and developer experience aligned with our TypeScript-first approach.

## Decision Drivers

- **Type Safety**: Generate TypeScript types from database schema
- **Developer Experience**: Simple, intuitive API for queries
- **Migrations**: Robust migration system with rollback support
- **Performance**: Efficient query generation and connection pooling
- **Constitution Alignment**: Supports "Type-Centric Contracts" principle (2.1)

## Considered Options

1. **Prisma ORM** - Modern ORM with TypeScript-first design
2. **TypeORM** - Mature ORM with decorator-based entities
3. **Knex.js** - SQL query builder without ORM abstractions

## Decision Outcome

**Chosen option**: Prisma ORM

### Positive Consequences

- **Auto-generated types**: `@prisma/client` generates TypeScript types from `schema.prisma`
- **Migration workflow**: `prisma migrate dev` handles schema changes safely
- **Type-safe queries**: Full IntelliSense support, compile-time query validation
- **Performance**: Efficient query generation, built-in connection pooling
- **Prisma Studio**: Built-in GUI for database exploration
- **Active ecosystem**: Strong community, frequent updates, excellent documentation

### Negative Consequences

- **Generated client**: Adds build step (`prisma generate`)
- **Query flexibility**: Complex queries may require raw SQL fallback
- **Learning curve**: Developers must learn Prisma-specific syntax
- **Vendor lock-in**: Migration to another ORM would require significant refactoring

## Pros and Cons of Other Options

### TypeORM

- ✅ Mature, widely adopted
- ✅ Decorator-based entities familiar to backend developers
- ❌ Less robust TypeScript inference
- ❌ Migration experience less polished than Prisma
- ❌ Decorator syntax conflicts with project preference for explicit types

### Knex.js

- ✅ Lightweight, minimal abstractions
- ✅ Maximum query control
- ❌ No automatic type generation
- ❌ No ORM features (relations, models)
- ❌ More boilerplate for common operations

## Implementation Notes

### Schema Definition

```prisma
// apps/server/prisma/schema.prisma
model Station {
  id String @id @db.VarChar(16)
  name String
  lat Float
  lon Float
  source String @default("NDBC")
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  observations Observation[]
}

model Observation {
  id String @id @default(cuid())
  stationId String
  observedAt DateTime
  waveHeightM Float?
  windSpeedMps Float?
  // ... other fields
  station Station @relation(fields: [stationId], references: [id])
  @@unique([stationId, observedAt], name: "stationId_observedAt")
}
```

### Client Usage

```typescript
import { prisma } from "../lib/prisma.js";

// Type-safe query
const stations = await prisma.station.findMany({
  where: { isActive: true },
  include: { observations: true },
});
```

### Migration Workflow

```bash
# Create migration
pnpm -F @app/server prisma:migrate

# Generate client
pnpm -F @app/server prisma:generate

# Open Studio GUI
pnpm -F @app/server prisma:studio
```

## Compliance

- ✅ **Constitution 2.1**: Type-Centric Contracts (full TypeScript type generation)
- ✅ **Constitution 2.4**: Simplicity (declarative schema, minimal boilerplate)
- ✅ **Constitution 2.8**: Data Integrity (schema constraints, foreign keys, unique constraints)

## Links

- [Prisma Documentation](https://www.prisma.io/docs)
- [Project Constitution](../../.specify/memory/constitution.md)
- [Schema File](../../apps/server/prisma/schema.prisma)
