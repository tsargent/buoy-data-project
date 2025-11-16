# Implementation Tasks: Real-Time Buoy Data Streaming

**Feature Branch**: `002-realtime-stream`  
**Created**: 2025-11-15  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Task List

### Phase 1: Server Infrastructure Setup

#### Task 1.1: Add Redis client to server

**Priority**: P0 (Blocker)  
**Estimate**: 1.5 hours  
**Dependencies**: None

**Description**:
Install and configure Redis client in the server application for pub/sub functionality.

**Steps**:
- [ ] Add `ioredis` dependency to `apps/server/package.json` (version matching worker: `^5.8.2`)
- [ ] Run `pnpm install` from workspace root
- [ ] Update `apps/server/src/env.ts` to include `REDIS_URL`:
  - Add `REDIS_URL: z.string().url().default("redis://localhost:6379")`
- [ ] Create `apps/server/lib/redis.ts` with:
  - Redis client singleton using ioredis
  - Publisher client instance
  - Subscriber client instance (separate connection required for pub/sub)
  - Connection error handling
  - Reconnection logic with exponential backoff
  - Graceful shutdown handler
- [ ] Export `getPublisher()` and `getSubscriber()` functions
- [ ] Add connection logging (info level on connect, error level on failure)
- [ ] Test Redis connection by running server

**Acceptance Criteria**:
- [ ] `pnpm install` completes successfully
- [ ] TypeScript compiles without errors
- [ ] Server starts and connects to Redis
- [ ] Redis connection logs appear in console
- [ ] Graceful shutdown closes Redis connections properly
- [ ] Handles Redis unavailable scenario gracefully

**Related Requirements**: FR-003 (infrastructure for Redis Pub/Sub)

---

#### Task 1.2: Create SSE connection manager

**Priority**: P0 (Blocker)  
**Estimate**: 2 hours  
**Dependencies**: None

**Description**:
Build a connection manager to track active SSE clients and broadcast events to all connected clients.

**Steps**:
- [ ] Create `apps/server/lib/sse-manager.ts` with `ConnectionManager` class
- [ ] Implement connection storage:
  - Use `Set<FastifyReply>` to store active reply objects
  - Add `Map<FastifyReply, Date>` to track connection timestamps
- [ ] Implement `addClient(reply: FastifyReply): void`:
  - Add reply to active connections set
  - Record connection timestamp
  - Increment connection counter
- [ ] Implement `removeClient(reply: FastifyReply): void`:
  - Remove reply from active connections
  - Calculate and record connection duration
  - Decrement connection counter
- [ ] Implement `broadcastToAll(eventType: string, data: any): number`:
  - Format SSE message: `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
  - Iterate through active connections
  - Write to each `reply.raw`
  - Handle write errors (remove dead connections)
  - Return count of successful broadcasts
- [ ] Implement `getConnectionCount(): number`
- [ ] Add logging for key operations (debug level)
- [ ] Export singleton instance

**Acceptance Criteria**:
- [ ] TypeScript compiles without errors
- [ ] Can add clients to connection manager
- [ ] Can remove clients from connection manager
- [ ] Broadcast sends to all registered clients
- [ ] Dead connections are detected and removed
- [ ] Connection count is accurate
- [ ] Memory usage is stable (no leaks)

**Related Requirements**: FR-007, FR-008, SC-003

---

### Phase 2: SSE Endpoint Implementation

#### Task 2.1: Create SSE route handler

**Priority**: P0 (Blocker)  
**Estimate**: 2 hours  
**Dependencies**: Task 1.2

**Description**:
Implement the `/v1/observations/stream` endpoint with proper SSE headers and connection handling.

**Steps**:
- [ ] Create `apps/server/src/routes/stream.ts` (or add to `observations.ts`)
- [ ] Implement `GET /v1/observations/stream` route handler
- [ ] Set SSE response headers:
  - `Content-Type: text/event-stream`
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
  - `X-Accel-Buffering: no` (nginx compatibility)
- [ ] Use `reply.raw` to bypass Fastify serialization
- [ ] Keep connection open (don't call `reply.send()`)
- [ ] Add client to connection manager: `connectionManager.addClient(reply)`
- [ ] Add to `apps/server/src/app.ts` routes registration
- [ ] Test endpoint returns 200 and keeps connection open

**Acceptance Criteria**:
- [ ] Route registered at `/v1/observations/stream`
- [ ] Client can connect via `new EventSource('/v1/observations/stream')`
- [ ] Connection remains open (no immediate close)
- [ ] Response headers are correct for SSE
- [ ] Multiple clients can connect simultaneously
- [ ] Server logs connection events

**Related Requirements**: FR-001, FR-006

---

#### Task 2.2: Send connection event

**Priority**: P0 (Blocker)  
**Estimate**: 1 hour  
**Dependencies**: Task 2.1

**Description**:
Send a connection confirmation event immediately when a client connects.

**Steps**:
- [ ] Create helper function `sendConnectionEvent(reply: FastifyReply): void`
- [ ] Generate connection event payload:
  ```typescript
  {
    status: 'connected',
    timestamp: new Date().toISOString()
  }
  ```
- [ ] Format as SSE event:
  ```
  event: connection
  data: {"status":"connected","timestamp":"2025-11-15T12:00:00.000Z"}
  
  ```
- [ ] Write to `reply.raw` in route handler immediately after adding client
- [ ] Ensure proper SSE format (event line, data line, blank line)
- [ ] Add error handling for write failures
- [ ] Test connection event is received by EventSource client

**Acceptance Criteria**:
- [ ] Client receives connection event within 100ms (SC-001)
- [ ] Event type is `connection`
- [ ] Payload includes `status` and `timestamp` fields
- [ ] Timestamp is valid ISO 8601 format
- [ ] Event follows SSE format specification
- [ ] Works with native browser EventSource API

**Related Requirements**: FR-002, SC-001

---

#### Task 2.3: Handle client disconnections

**Priority**: P0 (Blocker)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 2.1

**Description**:
Detect when clients disconnect and properly clean up resources.

**Steps**:
- [ ] Add event listener: `request.raw.on('close', () => {...})`
- [ ] In close handler:
  - Call `connectionManager.removeClient(reply)`
  - Log disconnection event (info level)
  - Include connection duration in log
- [ ] Add event listener: `request.raw.on('error', (err) => {...})`
- [ ] In error handler:
  - Log error (error level)
  - Call `connectionManager.removeClient(reply)`
- [ ] Test cleanup by:
  - Opening connection
  - Closing browser tab
  - Verifying cleanup occurs
  - Checking connection count decreases
- [ ] Verify no memory leaks with repeated connect/disconnect cycles

**Acceptance Criteria**:
- [ ] Closing browser tab triggers cleanup
- [ ] Client is removed from connection registry
- [ ] Connection count metric updates correctly
- [ ] No memory leaks after 100+ connect/disconnect cycles
- [ ] Cleanup occurs within 5 seconds (SC-004)
- [ ] Errors don't crash the server

**Related Requirements**: FR-007, SC-004

---

### Phase 3: Redis Pub/Sub Integration

#### Task 3.1: Subscribe to observations channel in server

**Priority**: P0 (Blocker)  
**Estimate**: 2 hours  
**Dependencies**: Task 1.1

**Description**:
Configure the server to subscribe to the Redis `observations:new` channel on startup.

**Steps**:
- [ ] Create `apps/server/lib/redis-subscriber.ts` (or add to `redis.ts`)
- [ ] Implement `initializeSubscriber()` function:
  - Get subscriber client from redis.ts
  - Subscribe to `observations:new` channel
  - Add error handler: `subscriber.on('error', ...)`
  - Add subscribe confirmation handler: `subscriber.on('subscribe', ...)`
  - Add reconnect handler: `subscriber.on('reconnecting', ...)`
- [ ] Call `initializeSubscriber()` in server startup (index.ts)
- [ ] Add error handling for subscription failures
- [ ] Log subscription confirmation (info level)
- [ ] Test subscription by publishing test message via Redis CLI:
  ```bash
  redis-cli PUBLISH observations:new '{"test":"data"}'
  ```
- [ ] Verify server receives message (log it)

**Acceptance Criteria**:
- [ ] Server subscribes to `observations:new` on startup
- [ ] Subscription logged in console
- [ ] Server handles Redis connection errors gracefully
- [ ] Server automatically reconnects if Redis connection lost
- [ ] Test messages published via Redis CLI are received
- [ ] Subscription survives server restart

**Related Requirements**: FR-003, FR-009

---

#### Task 3.2: Broadcast messages to SSE clients

**Priority**: P0 (Blocker)  
**Estimate**: 2.5 hours  
**Dependencies**: Task 1.2, Task 2.1, Task 3.1

**Description**:
Implement the message handler that broadcasts Redis messages to all SSE clients.

**Steps**:
- [ ] Create validation schema for observation messages using Zod:
  ```typescript
  const ObservationSchema = z.object({
    stationId: z.string(),
    timestamp: z.string().datetime(),
    waveHeightM: z.number().nullable(),
    windSpeedMps: z.number().nullable(),
    windDirDeg: z.number().nullable(),
    waterTempC: z.number().nullable(),
    pressureHpa: z.number().nullable()
  });
  ```
- [ ] Implement message handler:
  ```typescript
  subscriber.on('message', (channel, message) => {
    // Parse JSON
    // Validate schema
    // Broadcast to clients
  });
  ```
- [ ] In message handler:
  - Parse JSON message payload
  - Validate observation schema (log error if invalid)
  - Call `connectionManager.broadcastToAll('observation', observationData)`
  - Log broadcast events (debug level) with client count
- [ ] Add error handling for:
  - Invalid JSON
  - Schema validation failures
  - Broadcast failures
- [ ] Measure and log broadcast latency (from Redis message to SSE send)
- [ ] Test end-to-end: publish Redis message → verify SSE clients receive it

**Acceptance Criteria**:
- [ ] Redis messages trigger broadcasts to all SSE clients
- [ ] Event type is `observation`
- [ ] Payload matches observation schema (FR-004)
- [ ] Invalid messages logged but don't crash server
- [ ] Messages delivered within 200ms of Redis publish (FR-009, SC-002)
- [ ] All connected clients receive identical messages
- [ ] Broadcast latency is logged for monitoring

**Related Requirements**: FR-003, FR-004, FR-005, FR-009, SC-002

---

#### Task 3.3: Handle Redis connection failures

**Priority**: P1 (High)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 3.1, Task 2.1

**Description**:
Implement robust error handling for Redis connection failures.

**Steps**:
- [ ] In stream route handler, check Redis connection status:
  - Get subscriber client status
  - If disconnected, return HTTP 500
- [ ] Create error response format:
  ```typescript
  {
    error: "SERVICE_UNAVAILABLE",
    message: "Real-time streaming is temporarily unavailable",
    statusCode: 500
  }
  ```
- [ ] Add reconnection logic in redis-subscriber:
  - Use ioredis reconnection strategy
  - Log reconnection attempts (warn level)
  - Log successful reconnection (info level)
- [ ] Test scenarios:
  - Start server with Redis down → verify HTTP 500
  - Stop Redis while clients connected → verify existing connections continue
  - Restart Redis → verify server reconnects
  - Connect new client after Redis recovery → verify works
- [ ] Add health check for Redis connectivity

**Acceptance Criteria**:
- [ ] Redis unavailable → HTTP 500 response (FR-011)
- [ ] Error message is user-friendly
- [ ] Existing connections continue if Redis temporarily unavailable
- [ ] Server automatically reconnects when Redis recovers
- [ ] New connections fail with HTTP 500 if Redis down
- [ ] Redis errors logged appropriately (not crash server)

**Related Requirements**: FR-011, SC-005

---

### Phase 4: Worker Publishing Implementation

#### Task 4.1: Add Redis publisher to worker

**Priority**: P0 (Blocker)  
**Estimate**: 1 hour  
**Dependencies**: None (can be done in parallel with Phase 1-3)

**Description**:
Set up Redis publisher in the worker for sending observation events.

**Steps**:
- [ ] Verify `ioredis` already installed in worker (should be via BullMQ)
- [ ] Update `apps/worker/src/index.ts` or create `apps/worker/lib/redis-publisher.ts`
- [ ] Create publisher client instance:
  - Use existing Redis connection from BullMQ or create new client
  - Consider reusing BullMQ connection for efficiency
- [ ] Export `publishObservation(observation: ObservationMessage): Promise<void>`
- [ ] Add error handling for publish failures
- [ ] Test publisher:
  - Manually call `publishObservation()` with test data
  - Verify message appears in Redis (use Redis CLI MONITOR)
  - Verify server receives and broadcasts it

**Acceptance Criteria**:
- [ ] Worker has Redis publisher client initialized
- [ ] TypeScript compiles without errors
- [ ] Can publish test messages to Redis
- [ ] Published messages visible in Redis CLI MONITOR
- [ ] Server receives published messages

**Related Requirements**: FR-003

---

#### Task 4.2: Publish observation events after database insert

**Priority**: P0 (Blocker)  
**Estimate**: 2 hours  
**Dependencies**: Task 4.1

**Description**:
Integrate Redis publishing into the worker job processor after successful observation upserts.

**Steps**:
- [ ] Update worker job processor in `apps/worker/src/index.ts`
- [ ] After successful `prisma.observation.upsert()`:
  - Build observation message payload:
    ```typescript
    {
      stationId,
      timestamp: observedAt.toISOString(),
      waveHeightM: obs.waveHeight,
      windSpeedMps: obs.windSpeed,
      windDirDeg: obs.windDirection,
      waterTempC: obs.waterTemp,
      pressureHpa: obs.pressure
    }
    ```
  - Call `publishObservation(payload)`
  - Log publish event (debug level)
- [ ] Only publish if upsert succeeds (inside try block, after upsert)
- [ ] Consider batch publishing for multiple observations:
  - Option A: Publish each observation individually (simpler)
  - Option B: Collect all observations and publish in batch (more complex)
  - **Recommendation**: Start with Option A (individual publish)
- [ ] Add counter for published observations in job logs
- [ ] Test end-to-end:
  - Trigger worker job
  - Verify observations inserted to database
  - Verify Redis messages published
  - Verify SSE clients receive events

**Acceptance Criteria**:
- [ ] Worker publishes to `observations:new` after each successful upsert
- [ ] Payload matches observation schema (FR-004)
- [ ] Only successful observations are published
- [ ] Publishing happens within job transaction context
- [ ] Job logs show publish count
- [ ] End-to-end flow works: NDBC → Worker → DB → Redis → Server → Client

**Related Requirements**: FR-003, FR-004, FR-009

---

#### Task 4.3: Handle publish failures gracefully

**Priority**: P1 (High)  
**Estimate**: 1 hour  
**Dependencies**: Task 4.2

**Description**:
Ensure Redis publish failures don't prevent database inserts from succeeding.

**Steps**:
- [ ] Wrap `publishObservation()` call in try/catch
- [ ] In catch block:
  - Log error (error level) with context (stationId, observation timestamp)
  - Increment failed publish counter
  - Don't throw error (allow job to succeed)
- [ ] Add retry logic for transient failures:
  - Retry up to 3 times with exponential backoff (100ms, 200ms, 400ms)
  - Only for network errors, not validation errors
- [ ] Add metric for publish success/failure rate
- [ ] Test failure scenarios:
  - Stop Redis before worker runs
  - Verify observations still inserted to database
  - Verify publish errors logged
  - Verify job completes successfully

**Acceptance Criteria**:
- [ ] Redis publish failures don't prevent database insert
- [ ] Errors are logged with full context
- [ ] Worker continues processing subsequent observations
- [ ] Transient failures are retried (max 3 attempts)
- [ ] Permanent failures are logged but don't crash worker
- [ ] Publish failure rate is tracked via metrics

**Related Requirements**: Resilience and observability

---

### Phase 5: Error Handling and Edge Cases

#### Task 5.1: Implement stream initialization error handling

**Priority**: P1 (High)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 2.1, Task 3.3

**Description**:
Handle error scenarios during SSE stream initialization.

**Steps**:
- [ ] In stream route handler, add error checks before setting up SSE:
  - Check Redis subscriber connection status
  - Check database connectivity (optional health check)
  - Validate request method is GET
- [ ] Create error response helper:
  ```typescript
  function createStreamError(code: ErrorCode, message: string): ErrorResponse {
    return {
      error: code,
      message,
      statusCode: code === 'SERVICE_UNAVAILABLE' ? 500 : 400
    };
  }
  ```
- [ ] Return HTTP 500 if:
  - Redis subscriber not connected
  - Database health check fails (if implemented)
- [ ] Use existing error format from `lib/errors.ts`
- [ ] Close connection gracefully on initialization error
- [ ] Add logging for initialization errors
- [ ] Test error scenarios:
  - Stop Redis → try to connect → verify HTTP 500
  - Stop database → try to connect → verify HTTP 500

**Acceptance Criteria**:
- [ ] Redis unavailable → HTTP 500 response (FR-011)
- [ ] Database unavailable → HTTP 500 response (FR-011)
- [ ] Error responses match server error format
- [ ] Connection closes gracefully on error
- [ ] Errors are logged appropriately
- [ ] User-friendly error messages (SC-006)

**Related Requirements**: FR-011, SC-005, SC-006

---

#### Task 5.2: Validate SSE client requests

**Priority**: P2 (Medium)  
**Estimate**: 1 hour  
**Dependencies**: Task 2.1

**Description**:
Validate incoming SSE requests and reject invalid ones.

**Steps**:
- [ ] In stream route handler, add request validation:
  - Check request method is GET (should be enforced by Fastify route)
  - Check `Accept` header includes `text/event-stream` or `*/*`
  - Reject if Accept header explicitly excludes `text/event-stream`
- [ ] Create request validation schema (optional):
  ```typescript
  const SSERequestSchema = z.object({
    headers: z.object({
      accept: z.string().refine(
        (val) => val.includes('text/event-stream') || val.includes('*/*'),
        'Accept header must include text/event-stream'
      )
    })
  });
  ```
- [ ] Return HTTP 400 for invalid requests
- [ ] Add error response:
  ```typescript
  {
    error: "INVALID_REQUEST",
    message: "SSE streaming requires Accept: text/event-stream header",
    statusCode: 400
  }
  ```
- [ ] Test with various Accept headers:
  - `text/event-stream` → should work
  - `*/*` → should work
  - `application/json` only → should return 400
  - Missing Accept → check browser default

**Acceptance Criteria**:
- [ ] Non-GET requests return HTTP 405 (Method Not Allowed)
- [ ] Invalid Accept header returns HTTP 400 (FR-012)
- [ ] Error responses are user-friendly
- [ ] Valid requests proceed normally
- [ ] Validation doesn't break EventSource API compatibility

**Related Requirements**: FR-012, SC-005

---

#### Task 5.3: Handle edge cases

**Priority**: P2 (Medium)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 3.2, Task 4.2

**Description**:
Implement handling for edge cases identified in the specification.

**Steps**:
- [ ] Document edge case: **No observations available**
  - Connection established successfully
  - No events sent until observations available
  - Test: Connect with empty database → verify no crash
- [ ] Document edge case: **Worker not running**
  - Stream remains open but no observation events sent
  - Test: Stop worker → verify clients stay connected
- [ ] Document edge case: **High volume (50+ obs/sec)**
  - Fire-and-forget broadcast (no buffering)
  - Slow clients may miss events (TCP buffer fills)
  - Add comment in code documenting this behavior
  - Test: Simulate high volume with rapid Redis publishes
- [ ] Document edge case: **Slow client**
  - TCP backpressure may cause missed events
  - No special handling needed (OS handles TCP buffering)
  - Document in code comments
- [ ] Document edge case: **Duplicate observations**
  - Server broadcasts duplicates if worker processes same obs twice
  - Clients should deduplicate using stationId + timestamp
  - Document in API documentation
- [ ] Add integration test for edge cases
- [ ] Update API documentation with edge case behavior

**Acceptance Criteria**:
- [ ] All edge cases from spec are handled or documented
- [ ] No crashes in any edge case scenario
- [ ] Behavior matches specification edge case descriptions
- [ ] Appropriate logging for debugging edge cases
- [ ] Edge cases are documented in code and API docs

**Related Requirements**: Edge cases from specification

---

### Phase 6: Multi-Client Support and Concurrency

#### Task 6.1: Test concurrent connections

**Priority**: P1 (High)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 3.2

**Description**:
Verify the system supports multiple simultaneous SSE clients without issues.

**Steps**:
- [ ] Create test script `test-concurrent-clients.html`:
  - Open 10 EventSource connections simultaneously
  - Log events received by each client
  - Track which clients receive which events
  - Display connection status for each client
- [ ] Test scenarios:
  - Connect 10 clients → verify all receive connection event
  - Publish test message → verify all 10 clients receive it
  - Close 5 clients → verify remaining 5 continue working
  - Reconnect 5 clients → verify they receive events
- [ ] Monitor server:
  - Check connection count metric
  - Check memory usage (should be stable)
  - Check CPU usage during broadcasts
- [ ] Verify no race conditions:
  - Add/remove clients during broadcasts
  - Multiple clients connecting/disconnecting rapidly
- [ ] Test with browser's EventSource:
  - Open 10 browser tabs
  - Each tab connects to stream
  - Verify all tabs receive events

**Acceptance Criteria**:
- [ ] 10 concurrent clients connect successfully
- [ ] All clients receive connection events
- [ ] All clients receive observation events
- [ ] No data loss or duplication (SC-003)
- [ ] No race conditions in connection registry
- [ ] Connection count metric is accurate
- [ ] Memory usage is stable

**Related Requirements**: FR-008, SC-003, User Story 2

---

#### Task 6.2: Load testing

**Priority**: P2 (Medium)  
**Estimate**: 2 hours  
**Dependencies**: Task 6.1

**Description**:
Test system performance with 50+ concurrent connections.

**Steps**:
- [ ] Create load test script:
  - Use Node.js with `eventsource` package
  - Open 50+ concurrent EventSource connections
  - Track connection success/failure rate
  - Measure event delivery latency
  - Monitor dropped connections
- [ ] Alternatively, use load testing tool like `k6` or `artillery`
- [ ] Test with increasing load:
  - 10 clients → 25 → 50 → 75 → 100
  - Record metrics at each level
- [ ] Monitor server resources:
  - CPU usage (target <80%)
  - Memory usage (target stable, no leaks)
  - Event loop lag (Node.js metric)
  - Connection count
- [ ] Measure broadcast performance:
  - Publish observation event
  - Measure time for all clients to receive it
  - Target <200ms for 50 clients (SC-002)
- [ ] Test high-frequency broadcasts:
  - Publish 10 events/second
  - Verify all clients receive all events
  - Check for any dropped events
- [ ] Document load test results

**Acceptance Criteria**:
- [ ] Server handles 50+ concurrent clients (SC-003)
- [ ] Response time remains acceptable (<200ms)
- [ ] Memory usage is stable (no leaks)
- [ ] No performance degradation with many clients
- [ ] CPU usage stays under 80%
- [ ] All events delivered successfully
- [ ] Load test results documented

**Related Requirements**: SC-003, User Story 2

---

### Phase 7: Metrics and Observability

#### Task 7.1: Add SSE-specific metrics

**Priority**: P1 (High)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 1.2

**Description**:
Add Prometheus metrics for monitoring SSE streaming.

**Steps**:
- [ ] Update `apps/server/lib/metrics.ts` to add:
  - `sse_connections_total` (Gauge) - current active connections
    ```typescript
    new promClient.Gauge({
      name: 'sse_connections_total',
      help: 'Number of active SSE connections'
    })
    ```
  - `sse_events_sent_total` (Counter) - total events broadcast
    ```typescript
    new promClient.Counter({
      name: 'sse_events_sent_total',
      help: 'Total number of SSE events sent',
      labelNames: ['event_type']
    })
    ```
  - `sse_connection_duration_seconds` (Histogram) - connection lifetime
    ```typescript
    new promClient.Histogram({
      name: 'sse_connection_duration_seconds',
      help: 'Duration of SSE connections in seconds',
      buckets: [1, 10, 30, 60, 300, 600, 1800, 3600]
    })
    ```
  - `sse_broadcast_latency_ms` (Histogram) - time to broadcast to all clients
    ```typescript
    new promClient.Histogram({
      name: 'sse_broadcast_latency_ms',
      help: 'Time to broadcast event to all clients in milliseconds',
      buckets: [1, 5, 10, 25, 50, 100, 250, 500]
    })
    ```
- [ ] Update ConnectionManager to record metrics:
  - Increment gauge on addClient
  - Decrement gauge on removeClient
  - Record histogram on removeClient (connection duration)
- [ ] Update broadcast function to record metrics:
  - Increment counter on each broadcast
  - Measure and record broadcast latency
- [ ] Test metrics appear in `/metrics` endpoint
- [ ] Verify metrics update correctly

**Acceptance Criteria**:
- [ ] All new metrics appear in `/metrics` endpoint
- [ ] Counters increment correctly
- [ ] Gauge reflects current connection count accurately
- [ ] Histograms track distributions correctly
- [ ] Metrics are scrapable by Prometheus
- [ ] No performance impact from metrics collection

**Related Requirements**: Observability and monitoring

---

#### Task 7.2: Add structured logging

**Priority**: P1 (High)  
**Estimate**: 1 hour  
**Dependencies**: Task 2.1, Task 3.2

**Description**:
Add comprehensive structured logging for SSE operations.

**Steps**:
- [ ] Add logging to SSE route handler:
  - Client connection (info level):
    ```typescript
    request.log.info({ 
      event: 'sse_client_connected',
      connectionCount: connectionManager.getConnectionCount()
    }, 'SSE client connected');
    ```
  - Client disconnection (info level):
    ```typescript
    request.log.info({ 
      event: 'sse_client_disconnected',
      connectionDuration: durationMs,
      connectionCount: connectionManager.getConnectionCount()
    }, 'SSE client disconnected');
    ```
- [ ] Add logging to Redis subscriber:
  - Subscription established (info level)
  - Message received (debug level):
    ```typescript
    log.debug({
      event: 'redis_message_received',
      channel,
      stationId: observation.stationId
    }, 'Redis observation message received');
    ```
  - Broadcast completed (debug level):
    ```typescript
    log.debug({
      event: 'observation_broadcasted',
      stationId: observation.stationId,
      clientCount,
      latencyMs
    }, 'Observation broadcast to clients');
    ```
  - Connection errors (error level)
- [ ] Add logging to worker publisher:
  - Publish success (debug level)
  - Publish failure (error level)
- [ ] Ensure all logs include:
  - Request ID (for tracing)
  - Relevant context (stationId, clientCount, etc.)
  - Timestamps (automatic in structured logs)
- [ ] Test log output is readable and useful

**Acceptance Criteria**:
- [ ] Logs are structured (JSON format)
- [ ] Logs include relevant context (requestId, stationId, clientCount)
- [ ] Log levels are appropriate (info/debug/error)
- [ ] Easy to trace request flow through logs
- [ ] Request IDs link related log entries
- [ ] Logs help debug issues quickly

**Related Requirements**: Observability and debugging

---

### Phase 8: Testing and Validation

#### Task 8.1: Unit tests

**Priority**: P1 (High)  
**Estimate**: 3 hours  
**Dependencies**: Task 1.2, Task 3.2

**Description**:
Write unit tests for core SSE functionality.

**Steps**:
- [ ] Set up test environment in `apps/server/src/lib/__tests__/`
- [ ] Write tests for `ConnectionManager`:
  - Test addClient/removeClient
  - Test broadcastToAll with multiple clients
  - Test connection count tracking
  - Test dead connection removal
  - Mock FastifyReply objects
- [ ] Write tests for SSE message formatting:
  - Test connection event format
  - Test observation event format
  - Test proper SSE structure (event, data, blank line)
- [ ] Write tests for observation schema validation:
  - Test valid observation passes
  - Test invalid observation fails
  - Test null sensor values handled correctly
- [ ] Write tests for error handling:
  - Test Redis connection errors
  - Test invalid request handling
- [ ] Mock Redis pub/sub for isolated testing:
  - Use `ioredis-mock` or similar
  - Test subscription and message handling
- [ ] Aim for >80% code coverage
- [ ] Run tests: `pnpm --filter server test`

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] Code coverage >80% for new code
- [ ] Tests are fast (<5 seconds total)
- [ ] Tests are isolated (no real Redis needed)
- [ ] Tests run in CI/CD pipeline
- [ ] Edge cases are tested

**Related Requirements**: Code quality and reliability

---

#### Task 8.2: Integration tests

**Priority**: P1 (High)  
**Estimate**: 3 hours  
**Dependencies**: Task 4.2, Task 3.2

**Description**:
Test the full integration: worker → Redis → server → clients.

**Steps**:
- [ ] Set up integration test environment:
  - Start Redis (use docker-compose or test container)
  - Start server
  - Start worker or mock worker publisher
- [ ] Write integration test script (Node.js):
  - Import `eventsource` package
  - Create EventSource client
  - Verify connection event received
  - Publish test observation via Redis
  - Verify observation event received
  - Close connection
- [ ] Test full flow:
  - Worker inserts observation to database
  - Worker publishes to Redis
  - Server receives Redis message
  - Server broadcasts to SSE clients
  - Clients receive observation event
- [ ] Test reconnection:
  - Connect client
  - Close server
  - Restart server
  - Verify client reconnects (EventSource auto-reconnect)
- [ ] Test Redis failure recovery:
  - Connect client
  - Stop Redis
  - Restart Redis
  - Verify server reconnects
  - Verify events flow resumes
- [ ] Test with real database data:
  - Use test database with sample stations
  - Run worker to fetch real data
  - Verify events are published and received
- [ ] Document integration test setup and results

**Acceptance Criteria**:
- [ ] Full worker → Redis → server → client flow works
- [ ] All user story acceptance scenarios pass
- [ ] Reconnection works correctly
- [ ] Redis recovery works correctly
- [ ] Real data integration works
- [ ] Tests can run locally and in CI

**Related Requirements**: All user stories, FR-001 through FR-012

---

#### Task 8.3: Manual testing against success criteria

**Priority**: P0 (Blocker)  
**Estimate**: 2.5 hours  
**Dependencies**: All previous tasks

**Description**:
Systematically test all success criteria and user story acceptance scenarios.

**Steps**:
- [ ] Test SC-001: Connection event within 100ms
  - Open DevTools Network tab
  - Connect EventSource
  - Measure time to first event
  - Document result
- [ ] Test SC-002: Observation events within 200ms
  - Trigger worker job
  - Measure time from database insert to SSE event
  - Use timestamps in logs
  - Document result
- [ ] Test SC-003: 10 concurrent clients without data loss
  - Open 10 EventSource connections
  - Trigger worker to publish observation
  - Verify all 10 clients receive event
  - Document result
- [ ] Test SC-004: Cleanup within 5 seconds
  - Connect client
  - Close browser tab
  - Monitor server logs
  - Verify cleanup timing
  - Document result
- [ ] Test SC-005: Proper HTTP status codes
  - Test various error scenarios
  - Verify HTTP 500 for Redis down
  - Verify HTTP 400 for bad requests
  - Verify HTTP 200 for valid connections
  - Document results
- [ ] Test SC-006: Clients can parse and use events
  - Create simple browser client
  - Parse and display observation data
  - Verify event format works with EventSource API
  - Document result
- [ ] Test all User Story 1 acceptance scenarios (3 scenarios)
- [ ] Test all User Story 2 acceptance scenarios (2 scenarios)
- [ ] Test all User Story 3 acceptance scenarios (3 scenarios)
- [ ] Create test results document in `specs/002-realtime-stream/test-results.md`

**Acceptance Criteria**:
- [ ] All success criteria pass (SC-001 through SC-006)
- [ ] All user story acceptance scenarios pass
- [ ] Test results documented with measurements
- [ ] Screenshots captured where applicable
- [ ] Any issues documented and resolved

**Related Requirements**: All success criteria and user stories

---

#### Task 8.4: Browser client testing

**Priority**: P1 (High)  
**Estimate**: 2 hours  
**Dependencies**: Task 8.2

**Description**:
Test SSE streaming with real browser EventSource API across multiple browsers.

**Steps**:
- [ ] Create test HTML page `test-sse-client.html`:
  ```html
  <!DOCTYPE html>
  <html>
  <head><title>SSE Test Client</title></head>
  <body>
    <h1>SSE Test Client</h1>
    <div id="status">Disconnected</div>
    <div id="events"></div>
    <script>
      const eventSource = new EventSource('http://localhost:3000/v1/observations/stream');
      
      eventSource.addEventListener('connection', (event) => {
        console.log('Connection event:', event.data);
        document.getElementById('status').textContent = 'Connected';
      });
      
      eventSource.addEventListener('observation', (event) => {
        console.log('Observation event:', event.data);
        const div = document.createElement('div');
        div.textContent = event.data;
        document.getElementById('events').appendChild(div);
      });
      
      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        document.getElementById('status').textContent = 'Error';
      };
    </script>
  </body>
  </html>
  ```
- [ ] Test in Chrome:
  - Open DevTools
  - Monitor EventSource connection in Network tab
  - Verify events appear
  - Test reconnection (refresh page)
- [ ] Test in Firefox:
  - Repeat Chrome tests
  - Check for any browser-specific issues
- [ ] Test in Safari:
  - Repeat Chrome tests
  - Test on macOS Safari
- [ ] Test on mobile:
  - iOS Safari (if available)
  - Android Chrome (if available)
  - Or use browser DevTools device emulation
- [ ] Test reconnection behavior:
  - Restart server while client connected
  - Verify EventSource auto-reconnects
  - Verify events resume after reconnect
- [ ] Document browser compatibility results

**Acceptance Criteria**:
- [ ] Works in Chrome (desktop)
- [ ] Works in Firefox (desktop)
- [ ] Works in Safari (desktop)
- [ ] Works in Edge (desktop)
- [ ] EventSource API functions correctly
- [ ] Auto-reconnection works
- [ ] Mobile browsers work (or documented as not tested)
- [ ] FR-010 compliance verified (EventSource compatibility)

**Related Requirements**: FR-010, SC-006

---

### Phase 9: Documentation

#### Task 9.1: Update API documentation

**Priority**: P1 (High)  
**Estimate**: 1.5 hours  
**Dependencies**: Task 8.3

**Description**:
Document the SSE endpoint with examples and usage guidance.

**Steps**:
- [ ] Create or update `docs/API.md` (or add to existing API docs)
- [ ] Document `/v1/observations/stream` endpoint:
  - Method: GET
  - Response: text/event-stream
  - Status codes: 200, 400, 500
  - Headers required
  - Headers returned
- [ ] Document event types:
  - `connection` event with schema
  - `observation` event with schema
- [ ] Add browser JavaScript example:
  ```javascript
  const eventSource = new EventSource('/v1/observations/stream');
  
  eventSource.addEventListener('connection', (event) => {
    const data = JSON.parse(event.data);
    console.log('Connected:', data.timestamp);
  });
  
  eventSource.addEventListener('observation', (event) => {
    const observation = JSON.parse(event.data);
    console.log('New observation:', observation);
    // Use observation data for visualization/sonification
  });
  
  eventSource.onerror = () => {
    console.error('Connection lost, will auto-reconnect');
  };
  ```
- [ ] Add Node.js example using `eventsource` package
- [ ] Document edge cases and limitations:
  - Fire-and-forget broadcast model
  - Slow clients may miss events
  - No catch-up on reconnection
  - Client deduplication responsibility
- [ ] Update AUDIO_CLIENTS.md with SSE usage:
  - Add section on consuming SSE stream
  - Link to API documentation
  - Provide examples for different clients (browser, Node.js)

**Acceptance Criteria**:
- [ ] API documentation is complete and accurate
- [ ] Examples are tested and work
- [ ] Event schemas are documented
- [ ] Edge cases and limitations are documented
- [ ] AUDIO_CLIENTS.md includes SSE usage
- [ ] Code examples are copy-pasteable

**Related Requirements**: Documentation requirement

---

#### Task 9.2: Create implementation notes

**Priority**: P2 (Medium)  
**Estimate**: 1.5 hours  
**Dependencies**: All implementation tasks

**Description**:
Document the architecture, design decisions, and implementation details.

**Steps**:
- [ ] Create `docs/SSE_IMPLEMENTATION.md` or similar
- [ ] Document architecture:
  - Worker → Redis Pub/Sub → Server → Clients
  - Include architecture diagram (can reference plan.md)
  - Connection lifecycle
  - Message flow
- [ ] Document design decisions:
  - Why Redis Pub/Sub (reference ADR 003 if creating ADR)
  - Why fire-and-forget broadcast
  - Why no event buffering
  - Why no catch-up on reconnection
- [ ] Document connection lifecycle:
  - Client connects
  - Server sends connection event
  - Server subscribes to Redis
  - Worker publishes observations
  - Server broadcasts to clients
  - Client disconnects
  - Server cleans up
- [ ] Document error handling approach:
  - HTTP 500 for infrastructure failures
  - HTTP 400 for client errors
  - Graceful degradation
  - Automatic reconnection
- [ ] Document known limitations:
  - Fire-and-forget model
  - Slow client handling
  - Browser connection limits
  - No historical playback
- [ ] Document monitoring and metrics:
  - Available Prometheus metrics
  - Key log events
  - Health check approach

**Acceptance Criteria**:
- [ ] Implementation notes are clear and complete
- [ ] Architecture is well documented
- [ ] Design decisions are explained
- [ ] Future developers can understand the system
- [ ] Maintenance guidance provided

**Related Requirements**: Documentation and maintainability

---

#### Task 9.3: Update README and consider ADR

**Priority**: P2 (Medium)  
**Estimate**: 1 hour  
**Dependencies**: Task 9.1, Task 9.2

**Description**:
Update project README with SSE information and consider creating an ADR for Redis Pub/Sub.

**Steps**:
- [ ] Update root `README.md` or server README:
  - Add Redis to prerequisites
  - Document REDIS_URL environment variable
  - Add instructions for SSE endpoint usage
  - Link to API documentation
- [ ] Update environment variable documentation:
  - Add REDIS_URL to .env.example files
  - Document default value
  - Explain purpose
- [ ] Add troubleshooting section:
  - "SSE connection fails" → Check Redis is running
  - "No events received" → Check worker is running
  - "Connection keeps dropping" → Check firewall/proxy
  - Redis connection errors
- [ ] Consider creating ADR 004 (optional but recommended):
  - Title: "Use Redis Pub/Sub for Worker-to-Server Communication"
  - Context: Need to broadcast observations from worker to server
  - Decision: Redis Pub/Sub
  - Alternatives considered: Database polling, HTTP webhooks, shared EventEmitter
  - Consequences: Adds Redis dependency, enables horizontal scaling
  - **Recommendation**: Create this ADR as it's a significant architectural decision
- [ ] Update docker-compose.yml if needed:
  - Ensure Redis service is documented
  - Add comments explaining Redis usage

**Acceptance Criteria**:
- [ ] README is up to date
- [ ] All new environment variables documented
- [ ] Clear instructions for running with SSE
- [ ] Troubleshooting section helpful
- [ ] ADR 004 created (recommended)

**Related Requirements**: Documentation and architecture

---

## Task Summary

**Total Tasks**: 27 tasks  
**Estimated Time**: 45.5 hours

### By Priority:

- **P0 (Blocker)**: 12 tasks (~21.5 hours) - Critical path
- **P1 (High)**: 11 tasks (~20 hours) - Important for quality
- **P2 (Medium)**: 4 tasks (~4 hours) - Nice to have

### By Phase:

- **Phase 1**: 2 tasks (3.5 hours) - Server infrastructure
- **Phase 2**: 3 tasks (4.5 hours) - SSE endpoint
- **Phase 3**: 3 tasks (6 hours) - Redis integration
- **Phase 4**: 3 tasks (4 hours) - Worker publishing
- **Phase 5**: 3 tasks (4 hours) - Error handling
- **Phase 6**: 2 tasks (3.5 hours) - Multi-client support
- **Phase 7**: 2 tasks (2.5 hours) - Metrics
- **Phase 8**: 4 tasks (10.5 hours) - Testing
- **Phase 9**: 3 tasks (4 hours) - Documentation
- **Phase 10**: 2 tasks (3 hours) - Final integration

### Critical Path:

1. Task 1.1 → Task 1.2 → Task 2.1 → Task 2.2 → Task 2.3
2. Task 1.1 → Task 3.1 → Task 3.2 → Task 3.3
3. Task 4.1 → Task 4.2 → Task 4.3
4. Task 8.1 → Task 8.2 → Task 8.3

**Critical Path Duration**: ~25 hours

### Parallel Work Opportunities:

- **Phase 1 and Phase 4** can be done in parallel (server and worker setup)
- **Task 3.1** can start as soon as Task 1.1 completes
- **Phase 5** can be done while Phase 3-4 are in progress
- **Task 7.1** and **Task 7.2** can be done anytime after Phase 2
- Testing tasks should be performed incrementally, not just at end

### Testing Strategy:

- **Unit tests** (Task 8.1): Test individual components in isolation
- **Integration tests** (Task 8.2): Test full flow with real Redis
- **Manual tests** (Task 8.3): Verify success criteria
- **Browser tests** (Task 8.4): Verify EventSource compatibility
- **Incremental testing**: Test each phase as it's completed

## Notes

- All tasks include detailed acceptance criteria
- Tasks map directly to functional requirements (FR-XXX) and success criteria (SC-XXX)
- Estimates assume familiarity with Node.js, TypeScript, Redis, and SSE
- Testing should be performed continuously throughout development
- Phase 4 (worker) can be developed in parallel with Phase 1-3 (server)
- Consider creating ADR 004 for Redis Pub/Sub decision (Task 9.3)
- Monitor performance throughout development (target <200ms event delivery)

## Risk Mitigation

**Risk**: Redis Pub/Sub unfamiliarity  
**Mitigation**: Task 3.1 includes testing with Redis CLI before full integration

**Risk**: SSE connection management complexity  
**Mitigation**: Task 1.2 builds connection manager first, tested independently

**Risk**: Late discovery of issues  
**Mitigation**: Incremental testing after each phase, early integration test in Task 8.2

**Risk**: Performance issues with many clients  
**Mitigation**: Load testing in Task 6.2 before final validation

**Risk**: Browser compatibility issues  
**Mitigation**: Multi-browser testing in Task 8.4

## Next Steps

1. ✅ Specification clarified
2. ✅ Implementation plan created
3. ✅ Task breakdown completed
4. 🔜 Create feature branch `002-realtime-stream`
5. 🔜 Begin Task 1.1: Add Redis client to server
6. 🔜 Follow task order or parallelize where indicated
