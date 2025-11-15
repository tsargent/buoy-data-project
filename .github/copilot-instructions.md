# GitHub Copilot Instructions for Buoy Data Project

## Project Overview
This is a TypeScript monorepo that ingests NOAA buoy data, stores it in PostgreSQL, processes it with BullMQ workers, and provides real-time streaming via REST API. The project demonstrates full-stack engineering with a creative twist: sonification of ocean data.

## Architecture
- **Monorepo**: PNPM workspaces with separate apps and shared packages
- **Apps**:
  - `apps/server`: Fastify REST API server with SSE/WebSocket support
  - `apps/worker`: BullMQ worker for data ingestion and processing
- **Packages**:
  - `packages/shared`: Shared TypeScript types and Zod schemas
- **Tech Stack**: Node 20, TypeScript, Fastify, Prisma ORM, BullMQ, Redis, PostgreSQL

## Coding Conventions

### TypeScript
- Use ES modules (`type: "module"` in package.json)
- Prefer explicit types over inference for public APIs
- Use Zod schemas for runtime validation and type generation
- Always use `.js` extensions in import statements (ESM requirement)
- Strict TypeScript configuration enabled

### API Development
- Use Fastify for all HTTP endpoints
- Follow RESTful conventions: `/stations`, `/observations/by-station/:id`
- Return appropriate HTTP status codes
- Use structured logging with Fastify's built-in logger (Pino)
- Enable CORS for development flexibility

### Database (Prisma)
- Define all models in `apps/server/prisma/schema.prisma`
- Use camelCase for field names
- Always create migrations: `pnpm -F @app/server prisma:migrate`
- Generate client after schema changes: `pnpm -F @app/server prisma:generate`
- Use transactions for multi-step database operations

### Worker Queue (BullMQ)
- Keep job handlers idempotent
- Use proper error handling and retries
- Log job lifecycle events
- Emit events after successful processing for real-time updates

### Code Organization
- Keep route handlers in `apps/server/src/routes/`
- Put shared types in `packages/shared/src/`
- Environment variables in `.env` (see `.env.example`)
- Use dependency injection where appropriate

### Error Handling
- Use try-catch blocks for async operations
- Log errors with context
- Return user-friendly error messages via API
- Use Zod for input validation

### Testing
- No test framework currently configured (minimal project)
- When adding tests, prefer Vitest for TypeScript projects
- Test business logic, API endpoints, and worker job handlers

## Common Tasks

### Adding a New API Endpoint
1. Create or update route file in `apps/server/src/routes/`
2. Register route in `apps/server/src/app.ts`
3. Add types to `packages/shared/src/index.ts` if needed
4. Test with `pnpm -F @app/server dev`

### Adding a New Database Model
1. Update `apps/server/prisma/schema.prisma`
2. Run `pnpm -F @app/server prisma:migrate`
3. Run `pnpm -F @app/server prisma:generate`
4. Add TypeScript types to shared package if needed

### Adding a New Worker Job
1. Define job in `apps/worker/src/index.ts`
2. Add job processor function
3. Configure retry logic and error handling
4. Emit events for real-time updates if needed

## Real-Time Streaming
- Prefer SSE (Server-Sent Events) for simplicity
- Event format: `event: observation` with JSON data
- Keep connections alive with periodic heartbeats
- Handle client disconnections gracefully

## Development Workflow
```bash
# Install dependencies
pnpm install

# Start services (Postgres, Redis)
docker compose up -d

# Start server
pnpm -F @app/server dev

# Start worker
pnpm -F worker dev

# Run migrations
pnpm -F @app/server prisma:migrate

# Format code
pnpm format

# Lint code
pnpm lint

# Build all
pnpm build
```

## Best Practices
- Keep functions small and focused
- Avoid premature optimization
- Document complex logic with comments
- Use environment variables for configuration
- Validate all external inputs
- Log important events for debugging
- Handle edge cases (null values, missing data)
- Keep dependencies up to date but stable

## Audio Sonification Context
This project streams normalized buoy data for audio visualization/sonification. The data includes:
- Wave height (meters)
- Wind speed (m/s) and direction (degrees)
- Water temperature (°C)
- Air pressure (hPa)

Target clients: WebAudio API, Max/MSP, SuperCollider, ChucK, etc. See `docs/AUDIO_CLIENTS.md` for integration guidance.

## Performance Considerations
- Ingestion + processing should complete in < 1 second
- Real-time broadcast latency should be < 200ms
- Use connection pooling for database
- Implement rate limiting if needed
- Consider batching for bulk inserts

## Security Notes
- No authentication required (per PRD non-goals)
- Validate all inputs with Zod schemas
- Sanitize database queries (Prisma handles this)
- Use environment variables for secrets
- Don't commit `.env` files

## Documentation
- Keep `docs/PRD.md` as source of truth for requirements
- Update `docs/AUDIO_CLIENTS.md` when changing event schema
- Add inline comments for complex algorithms
- Update this file when conventions change
