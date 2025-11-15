# AI Context: Buoy Data Project Quick Reference

This file provides quick context for AI assistants working on this project.

## Project Summary
Real-time buoy data ingestion and streaming system for audio sonification of ocean observations.

## Tech Stack
- **Runtime**: Node.js 20, TypeScript (strict mode)
- **API**: Fastify + @fastify/cors + @fastify/jwt
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: BullMQ + Redis
- **Streaming**: Server-Sent Events (SSE)
- **Monorepo**: PNPM workspaces
- **Logging**: Pino (via Fastify)

## Architecture Pattern
```
[NOAA API] → [Worker Queue] → [Database] → [REST API] → [SSE Stream] → [Audio Clients]
     ↓           BullMQ         Postgres      Fastify                    WebAudio/Max/SC
```

## Key Files & Locations

### Database & API
- `apps/server/prisma/schema.prisma` - Database schema
- `apps/server/src/app.ts` - Fastify app setup
- `apps/server/src/routes/` - API route handlers
- `apps/server/lib/prisma.ts` - Prisma client instance

### Worker
- `apps/worker/src/index.ts` - BullMQ worker implementation

### Shared
- `packages/shared/src/index.ts` - Zod schemas and shared types

### Configuration
- `tsconfig.base.json` - Base TypeScript config
- `pnpm-workspace.yaml` - Workspace configuration
- `docker-compose.yml` - Services (Postgres, Redis)

## Database Schema

### stations
```typescript
{
  id: string           // NOAA station ID (e.g., "44009")
  name: string         // Human-readable name
  lat: number          // Latitude
  lon: number          // Longitude
  source?: string      // Data source
  isActive: boolean    // Active status
  createdAt: DateTime
  updatedAt: DateTime
}
```

### observations
```typescript
{
  id: string
  stationId: string    // Foreign key to stations
  observedAt: DateTime // When observation was recorded
  waveHeightM?: number // Wave height in meters
  windSpeedMps?: number // Wind speed in m/s
  windDirDeg?: number  // Wind direction in degrees
  waterTempC?: number  // Water temperature in Celsius
  pressureHpa?: number // Air pressure in hectopascals
  createdAt: DateTime
}
```

## API Endpoints

```
GET  /health                                    → { status: "ok" }
GET  /stations                                  → Station[]
GET  /stations/:id                              → Station
GET  /observations/by-station/:stationId        → Observation[]
     ?limit=100&since=ISO_DATE
GET  /stream                                    → SSE stream
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/buoy_data"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="secret-key"
PORT=3000
```

## Common Commands

```bash
# Development
pnpm -F @app/server dev      # Start API server
pnpm -F worker dev           # Start worker

# Database
pnpm -F @app/server prisma:generate  # Generate Prisma client
pnpm -F @app/server prisma:migrate   # Run migrations
pnpm -F @app/server prisma:studio    # Open DB GUI

# Code Quality
pnpm format                  # Format with Prettier
pnpm lint                    # Lint with ESLint
pnpm build                   # Build all packages

# Docker
docker compose up -d         # Start Postgres & Redis
docker compose down          # Stop services
```

## Code Conventions

### TypeScript
```typescript
// ✅ Use explicit types for public APIs
export async function getStation(id: string): Promise<Station | null>

// ✅ Use Zod for validation
const result = StationSchema.safeParse(data);

// ✅ Use .js extension in imports (ES modules)
import { prisma } from '../lib/prisma.js';

// ✅ Handle errors properly
try {
  const data = await fetchData();
} catch (error) {
  app.log.error({ error }, 'Failed to fetch');
  throw error;
}
```

### Fastify Routes
```typescript
// ✅ Type route parameters
app.get<{ Params: { id: string } }>(
  '/stations/:id',
  async (req, reply) => {
    const station = await getStation(req.params.id);
    if (!station) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return station;
  }
);
```

### Prisma
```typescript
// ✅ Use proper Prisma methods
const stations = await prisma.station.findMany({
  include: { observations: { take: 10 } }
});

// ✅ Use transactions for multi-step ops
await prisma.$transaction(async (tx) => {
  await tx.station.create({ data: stationData });
  await tx.observation.createMany({ data: observations });
});
```

## Real-Time Event Format

```typescript
// SSE Event
event: observation
data: {
  "stationId": "44009",
  "timestamp": "2024-01-15T12:00:00Z",
  "waveHeightM": 1.2,
  "windSpeedMps": 5.1,
  "windDirDeg": 180,
  "waterTempC": 12.4,
  "pressureHpa": 1012.8
}
```

## Audio Mapping Guide

Buoy observations → Audio parameters:
- **Wave Height** → Amplitude/Volume
- **Wind Speed** → Filter cutoff/Timbre
- **Wind Direction** → Pan position/Spatialization
- **Water Temperature** → Oscillator pitch/Frequency
- **Air Pressure** → LFO rate/Modulation depth

## Project Goals

### Core Features
- ✅ REST API for buoy data
- ✅ Prisma database schema
- 🚧 NOAA data fetching
- 🚧 BullMQ worker processing
- 🚧 Real-time SSE streaming
- ⏳ Error handling & retries
- ⏳ Comprehensive logging

### Non-Goals
- ❌ User authentication
- ❌ Complex frontend UI
- ❌ Historical analytics
- ❌ Cloud deployment (for now)

## Design Principles

1. **Keep it Simple**: Minimal surface area, clear responsibilities
2. **Type Safety**: Use TypeScript strictly, validate with Zod
3. **Observability**: Log important events with context
4. **Resilience**: Handle errors gracefully, retry failed jobs
5. **Performance**: Sub-second ingestion, <200ms streaming latency
6. **Scalability**: Support horizontal scaling of workers

## Testing Strategy

When tests are added:
- **Unit Tests**: Pure functions, utilities, validators
- **Integration Tests**: API endpoints, database operations
- **Worker Tests**: Job processing, retry logic
- **Use**: Vitest + Supertest + Testcontainers

## Common Patterns

### Error Response
```typescript
return reply.code(404).send({
  error: 'Station not found',
  details: { stationId: id }
});
```

### Logging
```typescript
app.log.info({ stationId, count }, 'Fetched observations');
app.log.error({ error, stationId }, 'Failed to fetch');
```

### Validation
```typescript
const parsed = ObservationSchema.safeParse(data);
if (!parsed.success) {
  return reply.code(400).send({ error: parsed.error });
}
```

## Resources

- PRD: `docs/PRD.md`
- Audio Clients: `docs/AUDIO_CLIENTS.md`
- Copilot Instructions: `.github/copilot-instructions.md`
- Custom Agents: `.github/agents/`

## Quick Debugging

```bash
# Check if services are running
docker compose ps

# View logs
docker compose logs -f postgres
docker compose logs -f redis

# Check API
curl http://localhost:3000/health

# Inspect database
pnpm -F @app/server prisma:studio

# Check TypeScript errors
pnpm -F @app/server build
```

## Status Indicators

- ✅ Completed
- 🚧 In Progress
- ⏳ Planned
- ❌ Not Planned

---

**Last Updated**: When adding this AI scaffolding
**Maintained By**: Project contributors
**Purpose**: Quick context for AI assistants and new developers
