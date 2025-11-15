# AI Development Guide

Quick reference for AI assistants working on specific development tasks.

## Common Task Patterns

### Adding a New API Endpoint

1. **Create/update route file**:
   ```typescript
   // apps/server/src/routes/myroute.ts
   import type { FastifyPluginAsync } from 'fastify';
   
   const myRoute: FastifyPluginAsync = async (app) => {
     app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
       // Implementation
     });
   };
   
   export default myRoute;
   ```

2. **Register in app.ts**:
   ```typescript
   await app.register(myRoute, { prefix: '/myroute' });
   ```

3. **Add types to shared package** (if needed):
   ```typescript
   // packages/shared/src/index.ts
   export const MySchema = z.object({ ... });
   export type My = z.infer<typeof MySchema>;
   ```

4. **Test**:
   ```bash
   pnpm -F @app/server dev
   curl http://localhost:3000/myroute/123
   ```

### Adding a Database Model

1. **Update schema**:
   ```prisma
   // apps/server/prisma/schema.prisma
   model MyModel {
     id        String   @id @default(uuid())
     field     String
     createdAt DateTime @default(now())
   }
   ```

2. **Create migration**:
   ```bash
   cd apps/server
   pnpm prisma migrate dev --name add_my_model
   ```

3. **Generate client**:
   ```bash
   pnpm -F @app/server prisma:generate
   ```

4. **Use in code**:
   ```typescript
   const result = await prisma.myModel.findMany();
   ```

### Adding a Worker Job

1. **Define job type**:
   ```typescript
   // apps/worker/src/types.ts
   export interface MyJobData {
     field: string;
   }
   ```

2. **Create processor**:
   ```typescript
   // apps/worker/src/processors/myProcessor.ts
   export async function processMyJob(data: MyJobData) {
     // Implementation
   }
   ```

3. **Register processor**:
   ```typescript
   // apps/worker/src/index.ts
   worker.process('my-job', async (job) => {
     await processMyJob(job.data);
   });
   ```

4. **Add to queue** (from server):
   ```typescript
   await queue.add('my-job', { field: 'value' });
   ```

### Creating a Real-Time Stream

1. **Setup SSE endpoint**:
   ```typescript
   app.get('/stream', async (req, reply) => {
     reply.raw.writeHead(200, {
       'Content-Type': 'text/event-stream',
       'Cache-Control': 'no-cache',
       'Connection': 'keep-alive',
     });
     
     const sendEvent = (data: any) => {
       reply.raw.write(`event: observation\n`);
       reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
     };
     
     // Setup event listeners
     eventEmitter.on('observation', sendEvent);
     
     // Cleanup on close
     req.raw.on('close', () => {
       eventEmitter.off('observation', sendEvent);
     });
   });
   ```

2. **Emit events** (from worker):
   ```typescript
   eventEmitter.emit('observation', observationData);
   ```

## Project-Specific Patterns

### Database Queries

```typescript
// Find with relations
const station = await prisma.station.findUnique({
  where: { id: stationId },
  include: {
    observations: {
      take: 100,
      orderBy: { observedAt: 'desc' }
    }
  }
});

// Filter with dates
const observations = await prisma.observation.findMany({
  where: {
    stationId,
    observedAt: {
      gte: new Date(since)
    }
  },
  take: limit,
  orderBy: { observedAt: 'desc' }
});

// Create with transaction
await prisma.$transaction([
  prisma.station.create({ data: stationData }),
  prisma.observation.createMany({ data: observations })
]);
```

### Validation Patterns

```typescript
// Validate request body
const result = MySchema.safeParse(req.body);
if (!result.success) {
  return reply.code(400).send({ 
    error: 'Invalid request',
    details: result.error.issues 
  });
}
const data = result.data;

// Validate and coerce
const limit = Math.min(
  parseInt(req.query.limit || '100'),
  100
);

// Validate date
const since = req.query.since 
  ? new Date(req.query.since)
  : new Date(Date.now() - 24 * 60 * 60 * 1000);
```

### Error Handling

```typescript
// Standard error response
try {
  const result = await operation();
  return result;
} catch (error) {
  app.log.error({ error, context: { id } }, 'Operation failed');
  
  if (error instanceof NotFoundError) {
    return reply.code(404).send({ error: 'Not found' });
  }
  
  return reply.code(500).send({ error: 'Internal server error' });
}

// Worker error handling
worker.on('failed', (job, error) => {
  logger.error({ 
    error, 
    jobId: job?.id,
    jobName: job?.name 
  }, 'Job failed');
});
```

### Logging Patterns

```typescript
// Request logging (automatic with Fastify)

// Custom event logging
app.log.info({ 
  stationId, 
  observationCount: observations.length 
}, 'Fetched observations');

// Error logging with context
app.log.error({ 
  error, 
  stationId,
  timestamp: new Date().toISOString()
}, 'Failed to process station data');

// Debug logging
app.log.debug({ query: req.query }, 'Processing request');
```

## Testing Patterns (Future)

### Unit Test
```typescript
describe('StationSchema', () => {
  it('should validate correct data', () => {
    const valid = { id: '44009', name: 'Test', lat: 38, lon: -74 };
    const result = StationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});
```

### Integration Test
```typescript
describe('GET /stations/:id', () => {
  it('should return station', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/stations/44009'
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('id', '44009');
  });
});
```

## Debugging Tips

### Check Database State
```bash
pnpm -F @app/server prisma:studio
# Opens GUI at http://localhost:5555
```

### View Logs
```bash
# Server logs (automatic with Fastify)
pnpm -F @app/server dev

# Worker logs
pnpm -F worker dev

# Docker logs
docker compose logs -f postgres
docker compose logs -f redis
```

### Test Endpoints
```bash
# Health check
curl http://localhost:3000/health

# Get stations
curl http://localhost:3000/stations

# Get observations
curl "http://localhost:3000/observations/by-station/44009?limit=10"

# Test SSE stream
curl -N http://localhost:3000/stream
```

### Common Issues

**Port in use**:
```bash
lsof -i :3000
kill -9 <PID>
```

**Prisma out of sync**:
```bash
pnpm -F @app/server prisma:generate
```

**Database connection failed**:
```bash
docker compose ps
docker compose up -d postgres
```

**Redis connection failed**:
```bash
docker compose ps
docker compose up -d redis
```

## File Organization Rules

### Route files
- One file per resource: `stations.ts`, `observations.ts`
- Export default `FastifyPluginAsync`
- Keep handlers focused and small
- Extract business logic to separate functions

### Type files
- Shared types in `packages/shared/src/`
- Use Zod for runtime validation
- Export both schema and type
- Keep types close to usage for internal types

### Configuration
- Environment variables in `.env` (not committed)
- Types for env in `src/env.ts`
- Validate required variables at startup

### Database
- All models in one `schema.prisma`
- Create migration for every schema change
- Use camelCase for field names
- Add indexes for frequently queried fields

## Performance Considerations

### Database
- Use `select` to limit fields
- Use `include` carefully (avoid N+1)
- Add indexes for filtered/sorted fields
- Use `take` to limit results
- Consider pagination for large datasets

### API
- Stream large responses
- Use compression for JSON
- Cache static responses
- Set appropriate timeouts
- Validate input early

### Worker
- Keep jobs idempotent
- Use appropriate retry strategies
- Don't block event loop
- Clean up resources in finally
- Monitor queue size

## Security Checklist

- [ ] Validate all inputs with Zod
- [ ] Use Prisma (prevents SQL injection)
- [ ] Secrets in environment variables
- [ ] No secrets in logs
- [ ] Sanitize error messages
- [ ] Set appropriate CORS
- [ ] Rate limiting (if needed)
- [ ] Input size limits

## Quick Reference Links

- **Project Docs**: `docs/PRD.md`, `docs/AUDIO_CLIENTS.md`
- **AI Context**: `.github/AI_CONTEXT.md`
- **Copilot Instructions**: `.github/copilot-instructions.md`
- **Custom Agents**: `.github/agents/`
- **API Tests**: `.vscode/api-requests.http`
- **Code Snippets**: `.vscode/buoy-data.code-snippets`

## Before Committing

1. **Format**: `pnpm format`
2. **Lint**: `pnpm lint`
3. **Build**: `pnpm build`
4. **Test**: `pnpm test` (when available)
5. **Check**: Review changed files
6. **Commit**: Use conventional commit messages

## Commit Message Format

```
<type>: <description>

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`

**Examples**:
- `feat: add real-time SSE streaming endpoint`
- `fix: handle null values in observation data`
- `docs: update API documentation for /stations`
- `refactor: extract validation logic to shared package`
- `chore: update dependencies`
