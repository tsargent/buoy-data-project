# Work Plan: Real-Time Buoy Data Streaming

**Feature Branch**: `002-realtime-stream`  
**Created**: 2025-11-15  
**Spec**: [spec.md](spec.md)

## Architecture Overview

### System Components

```
┌──────────────────────────────────────────────────────────────┐
│                     Browser Clients                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  EventSource API                                       │  │
│  │  GET /v1/observations/stream                           │  │
│  │  • Receives connection event                           │  │
│  │  • Receives observation events                         │  │
│  │  • Auto-reconnects on disconnect                       │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │ SSE (Server-Sent Events)
                             │ HTTP Long-lived Connection
┌────────────────────────────┼─────────────────────────────────┐
│                  Server (Fastify) - apps/server              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  SSE Route Handler: GET /v1/observations/stream        │  │
│  │  • Manages connection registry (Set<Response>)         │  │
│  │  • Sends connection event on connect                   │  │
│  │  │  • Broadcasts observation events to all clients     │  │
│  │  • Cleans up on disconnect                             │  │
│  └──────────────────────┬─────────────────────────────────┘  │
│                         │ SUBSCRIBE                           │
│  ┌──────────────────────┼─────────────────────────────────┐  │
│  │  Redis Subscriber    ▼                                 │  │
│  │  • Subscribes to 'observations:new' channel           │  │
│  │  • On message: broadcastToAllClients()                │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────┼─────────────────────────────────┘
                           │
                           │ Redis Pub/Sub
                           │ Channel: 'observations:new'
                           │
┌──────────────────────────┼─────────────────────────────────┐
│                         Redis                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Pub/Sub Channel: 'observations:new'                   │  │
│  │  • Worker publishes observation events                 │  │
│  │  • Server subscribes and receives events               │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  BullMQ Job Queue (existing)                           │  │
│  │  • Ingestion jobs                                      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────▲─────────────────────────────────┘
                           │ PUBLISH
┌──────────────────────────┼─────────────────────────────────┐
│                  Worker - apps/worker                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  BullMQ Job Processor                                  │  │
│  │  1. Fetch NDBC data                                    │  │
│  │  2. Parse observations                                 │  │
│  │  3. Upsert to database ─────────────────────┐          │  │
│  │  4. Publish to Redis ───────────────────────┼──────────┘  │
│  │     channel: 'observations:new'             │             │
│  │     payload: observation JSON               │             │
│  └─────────────────────────────────────────────┼─────────┘  │
└────────────────────────────────────────────────┼─────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  stations table                                        │  │
│  │  observations table (stationId, observedAt, sensors)   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Server Framework**: Fastify (existing)
- **Redis Client**: ioredis (already used by BullMQ in worker)
- **SSE Protocol**: Native HTTP with `Content-Type: text/event-stream`
- **Event Format**: JSON payloads in SSE `data:` field
- **Type Safety**: TypeScript with Zod validation
- **Testing**: Vitest (existing workspace setup)

### Data Flow Sequence

**Worker processes observation:**
```
1. Worker receives BullMQ job
2. Fetches NDBC data
3. Parses observations
4. Upserts to database via Prisma
5. Publishes to Redis: PUBLISH observations:new '{"stationId":"44009",...}'
```

**Server streams to clients:**
```
1. Client: new EventSource('/v1/observations/stream')
2. Server: Add client to connection registry
3. Server: Send connection event
4. Redis: Receives message on 'observations:new'
5. Server: Broadcasts to all registered clients
6. Client: Receives observation event, triggers audio/visual
```

### Observability Design (Pre-Implementation)

Defining metrics, logging fields, and tracing prior to coding satisfies constitution principles (Test-First & Observability as design input).

Metrics (Prometheus):
- `sse_connections_total` (Gauge): Active SSE connections.
- `sse_events_sent_total` (Counter, label `event_type`): Counts `connection` and `observation` events.
- `sse_connection_duration_seconds` (Histogram): Lifetime of connections (buckets: 1,10,30,60,300,600,1800,3600).
- `sse_broadcast_latency_ms` (Histogram): Time from Redis message receipt to last client write (buckets: 1,5,10,25,50,100,250,500).

Structured Log Events (JSON):
- `sse_client_connected` { connectionCount }
- `sse_client_disconnected` { connectionCount, connectionDurationMs }
- `redis_message_received` { channel, stationId }
- `observation_broadcasted` { stationId, clientCount, latencyMs }
- `redis_subscriber_error` { message }
- `publish_observation_failed` { stationId, timestamp, attempt }

Tracing / Correlation:
- Include `requestId` (Fastify request id) for connection/disconnection logs; broadcast logs may omit if not tied to a single request.

Error Shape:
All streaming errors: `{ "error": { "code": string, "message": string } }`.

Types:
Shared contracts (`ConnectionEvent`, `ObservationEvent`) exported from `packages/shared` ensure alignment across server, worker, demo clients.

Test Hooks:
- Latency measurement uses timestamps captured at Redis message handler start and after final write.
- Memory stability checked via periodic RSS sampling script (optional in load test phase).

These artifacts are declared before implementation; instrumentation wiring occurs during metrics/logging tasks.

## Implementation Tasks

### Phase 1: Server Infrastructure Setup

**Task 1.1: Add Redis client to server**
- Add `ioredis` dependency to `apps/server/package.json`
- Update `apps/server/src/env.ts` to include `REDIS_URL` (default: `redis://localhost:6379`)
- Create `apps/server/lib/redis.ts` with Redis client singleton
- Export publisher and subscriber clients (subscriber must be separate connection)
- Add connection error handling and reconnection logic

**Acceptance**:
- `pnpm install` completes successfully in server workspace
- Server starts and connects to Redis without errors
- Redis connection logs appear in server console
- Graceful shutdown closes Redis connections

**Task 1.2: Create SSE connection manager**
- Create `apps/server/lib/sse-manager.ts` with `ConnectionManager` class
- Implement `addClient(reply: FastifyReply)` to track connections
- Implement `removeClient(reply: FastifyReply)` to clean up on disconnect
- Implement `broadcastToAll(event: string, data: any)` to send events to all clients
- Use `Set<FastifyReply>` to store active connections
- Add connection counter for metrics

**Acceptance**:
- TypeScript compiles without errors
- Connection manager can add/remove clients
- Broadcast sends to all registered clients
- Disconnected clients are properly cleaned up

### Phase 2: SSE Endpoint Implementation (FR-001, FR-002, FR-006, FR-007)

**Task 2.1: Create SSE route handler**
- Create `apps/server/src/routes/stream.ts` (or extend `observations.ts`)
- Implement `GET /v1/observations/stream` route
- Set SSE headers:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no` (for nginx compatibility)
- Use `reply.raw` to bypass Fastify serialization
- Keep connection open (don't call `reply.send()`)
- Add client to connection manager

**Acceptance**:
- Route registered at `/v1/observations/stream`
- Client can connect via `new EventSource('/v1/observations/stream')`
- Connection remains open (no immediate close)
- Response headers are correct for SSE

**Task 2.2: Send connection event**
- Implement `sendConnectionEvent(reply)` helper function
- Format connection event per FR-002:
  ```
  event: connection
  data: {"status":"connected","timestamp":"2025-11-15T12:00:00.000Z"}
  
  ```
- Send connection event immediately when client connects
- Ensure proper SSE format (event line, data line, blank line)

**Acceptance**:
- Client receives connection event within 100ms (SC-001)
- Event type is `connection`
- Payload includes `status` and `timestamp` fields
- Timestamp is valid ISO 8601 format

**Task 2.3: Handle client disconnections**
- Add `request.raw.on('close', ...)` event listener
- Remove client from connection manager on close
- Log disconnection event
- Update connection counter metric

**Acceptance**:
- Closing browser tab triggers cleanup
- Client is removed from connection registry
- No memory leaks after multiple connect/disconnect cycles
- Cleanup occurs within 5 seconds (SC-004)

### Phase 3: Redis Pub/Sub Integration (FR-003, FR-009)

**Task 3.1: Subscribe to observations channel in server**
- Update `apps/server/src/index.ts` or create `apps/server/lib/redis-subscriber.ts`
- Create Redis subscriber client (separate from publisher)
- Subscribe to `observations:new` channel on server startup
- Add error handling for subscription failures
- Log subscription confirmation

**Acceptance**:
- Server subscribes to `observations:new` on startup
- Subscription logged in console
- Server handles Redis connection errors gracefully
- Server reconnects if Redis connection is lost

**Task 3.2: Broadcast messages to SSE clients**
- Implement message handler: `subscriber.on('message', (channel, message) => {...})`
- Parse JSON message payload
- Validate observation schema (stationId, timestamp, sensors)
- Format as SSE observation event:
  ```
  event: observation
  data: {"stationId":"44009","timestamp":"2025-11-15T12:00:00.000Z",...}
  
  ```
- Call `connectionManager.broadcastToAll('observation', observationData)`
- Log broadcast events (debug level)

**Acceptance**:
- Redis messages trigger broadcasts to all SSE clients
- Event type is `observation`
- Payload matches observation schema (FR-004)
- Messages delivered within 200ms of Redis publish (FR-009, SC-002)

**Task 3.3: Handle Redis connection failures**
- Implement error handling for subscriber connection loss
- Log errors with appropriate severity
- Attempt automatic reconnection
- Return HTTP 500 if Redis unavailable during stream initialization (FR-011)

**Acceptance**:
- Redis disconnect logged as error
- Server attempts reconnection
- New connections fail with HTTP 500 if Redis down
- Existing connections continue if Redis recovers

### Phase 4: Worker Publishing Implementation (FR-003)

**Task 4.1: Add Redis publisher to worker**
- Worker already has Redis connection for BullMQ
- Create separate Redis client for publishing (or reuse BullMQ connection)
- Update `apps/worker/src/index.ts` in job processor
- After successful `prisma.observation.upsert()`, publish to Redis

**Acceptance**:
- Worker has Redis publisher client initialized
- TypeScript compiles without errors
- Worker can publish messages to Redis

**Task 4.2: Publish observation events after database insert**
- In worker job processor, after successful upsert:
  ```typescript
  await redis.publish('observations:new', JSON.stringify({
    stationId,
    timestamp: observedAt.toISOString(),
    waveHeightM: obs.waveHeight,
    windSpeedMps: obs.windSpeed,
    windDirDeg: obs.windDirection,
    waterTempC: obs.waterTemp,
    pressureHpa: obs.pressure
  }));
  ```
- Only publish if upsert succeeds (inside try block, after upsert)
- Only publish newly inserted observations (check upsert result if possible)
- Log publish events (debug level)

**Acceptance**:
- Worker publishes to `observations:new` after each successful upsert
- Payload matches observation schema (FR-004)
- Only successful observations are published
- Publish failures logged but don't crash worker

**Task 4.3: Handle publish failures gracefully**
- Wrap publish in try/catch
- Log publish errors but don't fail job
- Database insert succeeds even if Redis publish fails
- Consider retry logic for transient failures

**Acceptance**:
- Redis publish failures don't prevent database insert
- Errors are logged appropriately
- Worker continues processing subsequent observations
- Transient failures are retried

### Phase 5: Error Handling and Edge Cases (FR-011, FR-012)

**Task 5.1: Implement stream initialization error handling**
- Check Redis connection status before accepting SSE connection
- Return HTTP 500 with error body if Redis unavailable
- Return HTTP 500 if database query fails during initialization
- Use proper error response format (match existing server error schema)

**Acceptance**:
- Redis unavailable → HTTP 500 response
- Database unavailable → HTTP 500 response
- Error responses match server error format
- Connection closes gracefully on error

**Task 5.2: Validate SSE client requests**
- Check `Accept` header includes `text/event-stream` or `*/*`
- Validate request method is GET
- Return HTTP 400 for invalid requests
- Add request validation schema

**Acceptance**:
- Non-GET requests return HTTP 405
- Invalid Accept header returns HTTP 400
- Error responses are user-friendly
- Valid requests proceed normally

**Task 5.3: Handle edge cases**
- No observations available → connection established, no events sent
- Worker not running → connection established, no events sent
- High volume (50 obs/sec) → fire-and-forget broadcast (no buffering)
- Slow client → may miss events (TCP buffer fills)
- Duplicate observations → server broadcasts duplicates (client handles dedup)

**Acceptance**:
- All edge cases handled per specification
- No crashes or hangs
- Behavior matches specification edge case descriptions
- Appropriate logging for debugging

### Phase 6: Multi-Client Support and Concurrency (FR-008, SC-003)

**Task 6.1: Test concurrent connections**
- Verify connection manager handles multiple simultaneous clients
- Test with 10 concurrent EventSource connections
- Verify all clients receive identical events
- Check for race conditions in add/remove client

**Acceptance**:
- 10 concurrent clients connect successfully
- All clients receive connection events
- All clients receive observation events
- No data loss or duplication (SC-003)
- No race conditions in connection registry

**Task 6.2: Load testing**
- Test with 50+ concurrent connections
- Verify server remains responsive
- Check memory usage doesn't grow unbounded
- Test broadcast performance with many clients

**Acceptance**:
- Server handles 50+ concurrent clients
- Response time remains acceptable
- Memory usage is stable
- No performance degradation

### Phase 7: Metrics and Observability

**Task 7.1: Add SSE-specific metrics**
- Add to `apps/server/lib/metrics.ts`:
  - `sse_connections_total` (Gauge) - current active connections
  - `sse_events_sent_total` (Counter) - total events broadcast
  - `sse_connection_duration_seconds` (Histogram) - connection lifetime
- Update metrics on connect/disconnect/broadcast

**Acceptance**:
- Metrics appear in `/metrics` endpoint
- Counters increment correctly
- Gauge reflects current connection count
- Histogram tracks connection duration

**Task 7.2: Add structured logging**
- Log SSE connection events (connect, disconnect)
- Log broadcast events (observation received, clients notified)
- Log Redis pub/sub events (subscribe, message received, error)
- Use appropriate log levels (info, debug, error)
- Include request IDs for tracing

**Acceptance**:
- Logs are structured (JSON format)
- Logs include relevant context (requestId, clientCount, stationId)
- Log levels are appropriate
- Easy to trace request flow through logs

### Phase 8: Testing and Validation

**Task 8.1: Unit tests**
- Test `ConnectionManager` class:
  - Add/remove clients
  - Broadcast to all clients
  - Handle disconnections
- Test SSE message formatting
- Test observation schema validation
- Mock Redis for isolated testing

**Acceptance**:
- All unit tests pass (`pnpm test`)
- Code coverage > 80% for new code
- Tests run in CI

**Task 8.2: Integration tests**
- Test full flow: worker publishes → server receives → clients get event
- Test multiple clients receive same event
- Test client reconnection
- Test Redis connection failures
- Test worker/server interaction

**Acceptance**:
- Integration tests pass
- All user story acceptance scenarios validated
- End-to-end flow works correctly

**Task 8.3: Manual testing against success criteria**
- SC-001: Connection event within 100ms ✓
- SC-002: Observation events within 200ms ✓
- SC-003: 10 concurrent clients without data loss ✓
- SC-004: Cleanup within 5 seconds ✓
- SC-005: Proper HTTP status codes ✓
- SC-006: Clients can parse and use events ✓

**Acceptance**:
- All success criteria verified
- Manual test results documented
- Any issues addressed before completion

**Task 8.4: Browser client testing**
- Create test HTML page with EventSource
- Test in Chrome, Firefox, Safari
- Test reconnection behavior
- Test on mobile browsers (iOS Safari, Android Chrome)
- Verify EventSource API compatibility (FR-010)

**Acceptance**:
- Works in all major browsers
- EventSource API functions correctly
- Auto-reconnection works
- Mobile browsers supported

### Phase 9: Documentation

**Task 9.1: Update API documentation**
- Document `/v1/observations/stream` endpoint
- Document SSE event types (`connection`, `observation`)
- Document event payload schemas
- Add examples for browser clients
- Update AUDIO_CLIENTS.md with SSE usage

**Acceptance**:
- API documentation is complete
- Examples are accurate and tested
- AUDIO_CLIENTS.md includes SSE client code

**Task 9.2: Create implementation notes**
- Document Redis Pub/Sub architecture
- Document connection lifecycle
- Document error handling approach
- Document fire-and-forget broadcast model
- Document known limitations

**Acceptance**:
- Implementation notes are clear
- Architecture is documented
- Future developers can understand the design

**Task 9.3: Update README**
- Add instructions for running with SSE
- Document Redis requirement
- Add troubleshooting section
- Update environment variables documentation

**Acceptance**:
- README is up to date
- All new env vars documented
- Clear instructions for running locally

## Data Flow Details

### Worker to Server Flow
```
Worker Job Processor
    ↓
1. Fetch NDBC data for station
    ↓
2. Parse observations (ndbc-parser)
    ↓
3. For each observation:
    ↓
4. prisma.observation.upsert({
     where: { stationId_observedAt: {...} },
     update: { sensors... },
     create: { stationId, observedAt, sensors... }
   })
    ↓
5. If upsert successful:
    ↓
6. redis.publish('observations:new', JSON.stringify({
     stationId: '44009',
     timestamp: '2025-11-15T12:00:00.000Z',
     waveHeightM: 1.2,
     windSpeedMps: 5.1,
     windDirDeg: 180,
     waterTempC: 12.4,
     pressureHpa: 1012.8
   }))
    ↓
7. Continue to next observation
```

### Server to Client Flow
```
Server Startup
    ↓
1. Initialize Redis subscriber client
    ↓
2. Subscribe to 'observations:new' channel
    ↓
3. subscriber.on('message', (channel, message) => {
     const observation = JSON.parse(message);
     connectionManager.broadcastToAll('observation', observation);
   })

Client Connection
    ↓
1. Client: new EventSource('/v1/observations/stream')
    ↓
2. Server: GET /v1/observations/stream handler
    ↓
3. Set SSE headers
    ↓
4. connectionManager.addClient(reply)
    ↓
5. Send connection event:
   event: connection
   data: {"status":"connected","timestamp":"..."}
   
    ↓
6. On request.raw.close: connectionManager.removeClient(reply)

Redis Message Received
    ↓
1. subscriber receives message on 'observations:new'
    ↓
2. Parse JSON: const obs = JSON.parse(message)
    ↓
3. connectionManager.broadcastToAll('observation', obs)
    ↓
4. For each client in registry:
    ↓
5. reply.raw.write('event: observation\n')
6. reply.raw.write('data: ' + JSON.stringify(obs) + '\n\n')
    ↓
7. Client EventSource.onmessage(event) receives observation
```

## API Contracts

### SSE Endpoint

**Endpoint**: `GET /v1/observations/stream`

**Request Headers**:
- `Accept: text/event-stream` (or `*/*`)

**Response Headers**:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**Response Status**:
- `200 OK` - Stream established successfully
- `400 Bad Request` - Invalid headers or method
- `500 Internal Server Error` - Redis or database unavailable

**SSE Event Format**:

**Connection Event** (sent immediately on connect):
```
event: connection
data: {"status":"connected","timestamp":"2025-11-15T12:00:00.000Z"}

```

**Observation Event** (sent when worker publishes):
```
event: observation
data: {"stationId":"44009","timestamp":"2025-11-15T12:00:00.000Z","waveHeightM":1.2,"windSpeedMps":5.1,"windDirDeg":180,"waterTempC":12.4,"pressureHpa":1012.8}

```

**Event Payload Schemas**:

```typescript
// Connection Event
interface ConnectionEvent {
  status: 'connected';
  timestamp: string; // ISO 8601
}

// Observation Event
interface ObservationEvent {
  stationId: string;
  timestamp: string; // ISO 8601
  waveHeightM: number | null;
  windSpeedMps: number | null;
  windDirDeg: number | null;
  waterTempC: number | null;
  pressureHpa: number | null;
}
```

### Redis Pub/Sub Contract

**Channel**: `observations:new`

**Message Format**: JSON string

**Payload Schema** (same as ObservationEvent above):
```json
{
  "stationId": "44009",
  "timestamp": "2025-11-15T12:00:00.000Z",
  "waveHeightM": 1.2,
  "windSpeedMps": 5.1,
  "windDirDeg": 180,
  "waterTempC": 12.4,
  "pressureHpa": 1012.8
}
```

## Testing Strategy

### Unit Testing
- **ConnectionManager**: Add/remove clients, broadcast to all
- **SSE Formatting**: Event format, data serialization
- **Schema Validation**: Observation payload validation
- **Error Handling**: Redis failures, invalid requests

### Integration Testing
- **Worker → Redis → Server**: Full pub/sub flow
- **Server → Clients**: Broadcast to multiple clients
- **Reconnection**: Client disconnect and reconnect
- **Concurrency**: 10+ simultaneous connections

### Manual Testing
- **Browser Testing**: Chrome, Firefox, Safari, Edge
- **Mobile Testing**: iOS Safari, Android Chrome
- **Network Conditions**: Slow connection, offline/online
- **Error Scenarios**: Redis down, server restart, worker down

### Load Testing
- **Concurrent Connections**: 50+ simultaneous clients
- **High Volume**: 50+ observations per second
- **Long-lived Connections**: 1+ hour connection duration
- **Memory Profiling**: Check for memory leaks

### Acceptance Testing
- **User Story 1**: P1 acceptance scenarios (3 scenarios)
- **User Story 2**: P2 acceptance scenarios (2 scenarios)
- **User Story 3**: P3 acceptance scenarios (3 scenarios)
- **All Functional Requirements**: FR-001 through FR-012
- **All Success Criteria**: SC-001 through SC-006

## Dependencies

### External Dependencies
- **Redis**: Already running for BullMQ (docker-compose)
- **PostgreSQL**: Already running (docker-compose)
- **NDBC API**: Already in use by worker
- **Browser Support**: Modern browsers with EventSource API

### Internal Dependencies
- **Existing Server**: Fastify app in `apps/server`
- **Existing Worker**: BullMQ worker in `apps/worker`
- **Existing Database**: Prisma schema with observations table
- **Existing Redis**: Used by BullMQ for job queue

### New NPM Packages
- `ioredis` in `apps/server/package.json` (already in worker)
- No other new dependencies required

### Environment Variables
```bash
# apps/server/.env
REDIS_URL=redis://localhost:6379  # New

# apps/worker/.env (already exists)
REDIS_URL=redis://localhost:6379  # Existing
```

## Risk Mitigation

### Risk: Redis connection failures affect streaming
**Mitigation**:
- Graceful degradation: return HTTP 500 for new connections
- Auto-reconnection for existing connections
- Comprehensive error logging
- Health check includes Redis connectivity

### Risk: High volume overwhelms server (50+ obs/sec)
**Mitigation**:
- Fire-and-forget broadcast (no buffering)
- Document that slow clients may miss events
- Monitor server CPU/memory under load
- Consider rate limiting if needed (post-MVP)

### Risk: Memory leaks from unclosed connections
**Mitigation**:
- Proper cleanup on disconnect
- Connection timeout (optional)
- Memory profiling during testing
- Monitor connection count metric

### Risk: Worker and server get out of sync
**Mitigation**:
- Redis Pub/Sub is reliable within single Redis instance
- Log all publish/subscribe events
- Monitor message delivery latency
- Test with simulated Redis restarts

### Risk: Browser EventSource limitations
**Mitigation**:
- Test in all major browsers
- Document known limitations (e.g., 6 connection limit per domain)
- Provide fallback recommendations
- Consider WebSocket alternative for future

### Risk: Time zone and timestamp formatting issues
**Mitigation**:
- All timestamps in UTC (ISO 8601)
- Worker stores UTC in database
- Server publishes UTC timestamps
- Clients handle local time conversion

## Definition of Done

A task is considered complete when:
1. Code is written and TypeScript compiles without errors
2. Acceptance criteria for the task are met
3. Unit tests written and passing (where applicable)
4. Code follows project linting rules
5. No console errors in normal operation
6. Changes committed to feature branch with clear commit message

The feature is complete when:
1. All tasks are done (Phases 1-9)
2. All functional requirements (FR-001 through FR-012) are implemented
3. All non-functional requirements met (200ms latency, 10+ concurrent clients)
4. All success criteria (SC-001 through SC-006) verified
5. All user story acceptance scenarios pass
6. Integration tests pass
7. Manual testing completed across browsers
8. Documentation updated (API docs, README, AUDIO_CLIENTS.md)
9. No known critical bugs
10. Feature branch ready for PR review

## Timeline Estimate

-### Development Phases
- **Phase 0**: Foundations (Shared Types, Test Scaffolding, Observability Plan) - 2 hours
- **Phase 1**: Server Infrastructure Setup - 3 hours
- **Phase 2**: SSE Endpoint Implementation - 4 hours
- **Phase 3**: Redis Pub/Sub Integration - 4 hours
- **Phase 4**: Worker Publishing - 2 hours
- **Phase 5**: Error Handling - 3 hours
- **Phase 6**: Multi-Client Support - 2 hours
- **Phase 7**: Metrics and Observability (instrumentation wiring) - 2 hours
- **Phase 8**: Testing and Validation - 4 hours
- **Phase 9**: Documentation - 2 hours

**Total Estimated Time**: 28 hours

**Breakdown by Priority**:
- P1 (Core Streaming): 13 hours (Phases 1-4)
- P2 (Multi-Client): 2 hours (Phase 6)
- P3 (Polish, Observability & Testing): 13 hours (Phases 0,5,7-9)

**Note**: Estimates assume familiarity with Fastify, Redis, and SSE. First-time implementation may take 30-35 hours. Testing and debugging may require additional time depending on issues discovered.

## Next Steps

1. ✅ Specification clarified and approved
2. ✅ Implementation plan created
3. 🔜 Create detailed task breakdown (`tasks.md`) including Phase 0 foundations
4. 🔜 Create feature branch `002-realtime-stream`
5. 🔜 Begin Phase 0 (types, test scaffolding, observability plan) then Phase 1
6. 🔜 Confirm ADR 004 for Redis Pub/Sub decision (already planned)
