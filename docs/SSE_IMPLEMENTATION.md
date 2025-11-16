# Server-Sent Events (SSE) Implementation

**Feature**: Real-Time Buoy Data Streaming  
**Implementation Date**: November 2024  
**Status**: Production Ready  
**Related**: [ADR 003](./adr/003-server-sent-events.md), [Spec 002](../specs/002-realtime-stream/spec.md)

## Overview

This document describes the implementation of real-time buoy observation streaming using Server-Sent Events (SSE) and Redis Pub/Sub. The system enables browser and Node.js clients to receive live ocean observations as they are processed by the worker.

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                      │
│                        (Docker)                              │
│  ┌──────────────────┐              ┌──────────────────┐    │
│  │   PostgreSQL     │              │      Redis       │    │
│  │   (Database)     │              │  (Pub/Sub Bus)   │    │
│  │   Port: 5432     │              │   Port: 6379     │    │
│  └──────────────────┘              └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
           ↓ writes                         ↑ publishes
           ↓                                ↑
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│                   (Node.js + TypeScript)                     │
│                                                               │
│  ┌──────────────────┐              ┌──────────────────┐    │
│  │     Worker       │              │     Server       │    │
│  │  (Data Fetcher)  │              │  (Fastify API)   │    │
│  │                  │              │                  │    │
│  │  • BullMQ Jobs   │              │  • REST API      │    │
│  │  • NDBC Parser   │              │  • SSE Endpoint  │    │
│  │  • DB Insert     │              │  • Redis Sub     │    │
│  │  • Redis Pub     │              │  • Broadcast     │    │
│  └──────────────────┘              └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                                              ↓ broadcasts
                                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Browser 1  │  │  Browser 2  │  │  Node.js    │        │
│  │ EventSource │  │ EventSource │  │   Client    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Layer Separation

**Why Three Layers?**

1. **Infrastructure Layer (Docker)**: 
   - PostgreSQL and Redis are **services** that provide persistence and messaging
   - Run in containers for easy setup and isolation
   - Started once with `docker compose up -d`
   - No application code, just data storage and message routing

2. **Application Layer (Node.js)**:
   - Worker and Server are **your custom applications**
   - Contain business logic (parsing NDBC data, serving API, streaming events)
   - Started separately (`pnpm dev`) for fast iteration and hot reload
   - Both are **clients** of PostgreSQL and Redis

3. **Client Layer**:
   - Browsers and Node.js apps that **consume** the API
   - Connect via HTTP and SSE
   - No knowledge of Redis or database internals

**Key Insight**: Redis is NOT part of your application - it's infrastructure that your application uses, just like PostgreSQL.

---

## Detailed Message Flow

### 1. Observation Ingestion (Worker → Database → Redis)

```typescript
// apps/worker/src/index.ts

// 1. Worker fetches data from NDBC
const observations = await fetchFromNDBC(stationId);

// 2. Worker inserts to database (UPSERT to prevent duplicates)
const obs = await prisma.observation.upsert({
  where: { 
    stationId_observedAt: { stationId, observedAt } 
  },
  create: { /* observation data */ },
  update: { /* observation data */ }
});

// 3. Worker publishes to Redis (only if insert succeeded)
await redis.publish('observations:new', JSON.stringify({
  stationId: obs.stationId,
  timestamp: obs.observedAt.toISOString(),
  waveHeightM: obs.waveHeightM,
  windSpeedMps: obs.windSpeedMps,
  windDirDeg: obs.windDirDeg,
  waterTempC: obs.waterTempC,
  pressureHpa: obs.pressureHpa
}));
```

**Why UPSERT?** Prevents duplicate observations if worker runs multiple times for the same time period. Only new observations are published to Redis.

---

### 2. Server Subscription (Server → Redis)

```typescript
// apps/server/lib/redis-subscriber.ts

// Server subscribes to Redis channel on startup
const subscriber = redis.duplicate();
await subscriber.subscribe('observations:new');

subscriber.on('message', (channel, message) => {
  if (channel === 'observations:new') {
    const observation = JSON.parse(message);
    
    // Validate observation schema
    const validated = ObservationSchema.parse(observation);
    
    // Broadcast to all SSE clients
    connectionManager.broadcastToAll('observation', validated);
  }
});
```

**Why Separate Subscriber Client?** Redis Pub/Sub requires a dedicated connection. You cannot use the same Redis client for both normal commands and pub/sub.

---

### 3. SSE Connection Lifecycle

#### Client Connects

```typescript
// apps/server/src/routes/observations.ts

app.get('/v1/observations/stream', async (request, reply) => {
  // 1. Set SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Nginx compatibility
    'Access-Control-Allow-Origin': '*', // CORS for dev
  });

  // 2. Send connection event immediately
  reply.raw.write(`event: connection\n`);
  reply.raw.write(`data: ${JSON.stringify({
    status: 'connected',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // 3. Register client in connection manager
  connectionManager.addClient(reply);

  // 4. Set up cleanup handlers
  request.raw.on('close', () => {
    connectionManager.removeClient(reply);
    request.log.info('SSE client disconnected');
  });

  request.raw.on('error', (err) => {
    request.log.error({ err }, 'SSE connection error');
    connectionManager.removeClient(reply);
  });

  // Connection stays open indefinitely
});
```

#### Server Broadcasts

```typescript
// apps/server/lib/sse-manager.ts

export class ConnectionManager {
  private connections = new Set<FastifyReply>();
  
  broadcastToAll(eventType: string, data: any): number {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    let successCount = 0;
    
    for (const reply of this.connections) {
      try {
        reply.raw.write(message);
        successCount++;
      } catch (error) {
        // Remove dead connection
        this.connections.delete(reply);
      }
    }
    
    return successCount;
  }
}
```

#### Client Receives

```javascript
// Browser client (test-sse-client.html)

const eventSource = new EventSource('http://localhost:3000/v1/observations/stream');

eventSource.addEventListener('connection', (event) => {
  const data = JSON.parse(event.data);
  console.log('Connected at:', data.timestamp);
});

eventSource.addEventListener('observation', (event) => {
  const obs = JSON.parse(event.data);
  console.log('New observation:', obs);
  // Update visualization, trigger sonification, etc.
});

eventSource.onerror = () => {
  console.error('Connection lost, will auto-reconnect');
  // EventSource automatically reconnects
};
```

---

## Design Decisions

### Why Redis Pub/Sub?

**Requirement**: Worker and Server are separate processes. Worker needs to notify Server when new observations are available.

**Alternatives Considered**:

1. **Database Polling**: Server queries database every N seconds
   - ❌ High latency (poll interval)
   - ❌ Database load
   - ❌ Inefficient (checks even when no new data)

2. **HTTP Webhooks**: Worker POSTs to Server endpoint
   - ❌ Tight coupling (Worker needs Server URL)
   - ❌ Single server only (no horizontal scaling)
   - ❌ More complex error handling

3. **Shared EventEmitter**: In-process event bus
   - ❌ Only works if Worker and Server in same process
   - ❌ Not suitable for distributed systems

4. **Redis Pub/Sub**: ✅ **CHOSEN**
   - ✅ Decoupled (Worker and Server don't know about each other)
   - ✅ Fast (<10ms latency)
   - ✅ Supports multiple subscribers (horizontal scaling)
   - ✅ Fire-and-forget (no persistence needed for real-time stream)
   - ✅ Already have Redis for BullMQ

**Trade-off**: Redis Pub/Sub is fire-and-forget (no message persistence). If Server is down, messages are lost. This is acceptable because:
- SSE is for real-time updates only
- Clients needing historical data query the REST API
- Worker continues to store data in database (persistent)

---

### Why Fire-and-Forget Broadcast?

**Design**: Server broadcasts observation events immediately to all clients without buffering.

**Alternatives Considered**:

1. **Buffered Broadcasting**: Queue messages per client, send in batches
   - ❌ Memory overhead (buffer per client)
   - ❌ Complexity (buffer management, expiration)
   - ❌ Latency (waiting for batch to fill)

2. **Persistent Per-Client Queue**: Redis queue for each client
   - ❌ High memory usage
   - ❌ Requires client authentication/identification
   - ❌ Complex cleanup

3. **Fire-and-Forget**: ✅ **CHOSEN**
   - ✅ Simple implementation
   - ✅ Low memory footprint
   - ✅ Minimal latency
   - ⚠️ Slow clients may miss events (TCP buffer fills)

**Trade-off**: Slow clients may miss events if their network can't keep up. This is acceptable because:
- Most clients are on fast connections
- Clients can detect gaps by checking observation timestamps
- Clients can query REST API to fill gaps
- Alternative is server memory exhaustion

---

### Why No Catch-Up on Reconnect?

**Design**: When client reconnects, it receives only NEW events (no historical playback).

**Rationale**:
- SSE is for real-time streaming, not historical data delivery
- REST API (`/v1/observations/by-station/:stationId`) exists for historical queries
- Server doesn't track "last seen" per client (stateless)
- Avoids memory overhead of per-client state

**Client Responsibility**: If client needs complete data:
1. Connect to SSE stream
2. Query REST API for recent observations (e.g., last 1 hour)
3. Deduplicate using `stationId + timestamp`
4. Continue receiving live updates via SSE

---

### Why UPSERT Instead of INSERT?

**Design**: Worker uses `UPSERT` (insert or update) when storing observations.

```typescript
await prisma.observation.upsert({
  where: { 
    stationId_observedAt: { stationId, observedAt } 
  },
  create: observationData,
  update: observationData
});
```

**Rationale**:
- NDBC data can be corrected/updated retroactively
- Worker may run multiple times for same time period (on-demand triggers)
- Prevents duplicate observations in database
- Unique constraint: `(stationId, observedAt)`

**Redis Publishing**: Only happens AFTER successful upsert. If observation already exists (UPDATE case), it's typically NOT re-published (implementation detail).

---

## Error Handling

### Redis Connection Failures

**Scenario**: Redis unavailable when client tries to connect

**Handling**:
```typescript
// Check Redis subscriber status before accepting connection
if (subscriber.status !== 'ready') {
  return reply.status(503).send({
    error: 'SERVICE_UNAVAILABLE',
    message: 'Real-time streaming is temporarily unavailable'
  });
}
```

**Auto-Recovery**: Server automatically reconnects to Redis using exponential backoff (ioredis default).

---

### Client Disconnections

**Scenario**: Client closes browser tab or network drops

**Handling**:
```typescript
request.raw.on('close', () => {
  connectionManager.removeClient(reply);
  metrics.sseConnectionsGauge.dec();
  
  const duration = Date.now() - connectionStartTime;
  metrics.sseConnectionDurationHistogram.observe(duration / 1000);
  
  request.log.info({ 
    event: 'sse_client_disconnected',
    connectionDuration: duration 
  });
});
```

**Cleanup**: Client removed from broadcast set within 5 seconds (TCP close detection).

---

### Malformed Messages

**Scenario**: Redis message doesn't match observation schema

**Handling**:
```typescript
subscriber.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);
    const validated = ObservationSchema.parse(data); // Zod validation
    connectionManager.broadcastToAll('observation', validated);
  } catch (error) {
    // Log error but don't crash server
    logger.error({ error, message }, 'Invalid observation message from Redis');
    metrics.invalidMessagesCounter.inc();
  }
});
```

**Result**: Invalid messages are logged and ignored. Server continues processing valid messages.

---

### Slow Clients

**Scenario**: Client network is slow, TCP buffer fills up

**Handling**: 
```typescript
// Fire-and-forget write
try {
  reply.raw.write(message);
} catch (error) {
  // Client likely disconnected, remove from set
  this.connections.delete(reply);
}
```

**Trade-off**: Slow clients may miss events. This is by design to protect server memory.

**Client Mitigation**: 
- Monitor `observation.timestamp` for gaps
- Query REST API to fill missing data
- Improve network connection

---

## Connection Lifecycle Details

### Startup Sequence

```
1. Server starts
   ├─> Initialize Redis subscriber client
   ├─> Subscribe to 'observations:new' channel
   ├─> Wait for subscription confirmation
   └─> Server ready to accept SSE connections

2. Worker starts (independent of server)
   ├─> Initialize Redis publisher client
   ├─> Initialize BullMQ queue
   └─> Start processing jobs

3. Client connects
   ├─> HTTP GET /v1/observations/stream
   ├─> Server checks Redis subscriber is ready
   ├─> Server sets SSE headers
   ├─> Server sends 'connection' event
   ├─> Server registers client in ConnectionManager
   ├─> Connection stays open
   └─> Client receives events until disconnect
```

### Runtime Flow

```
Worker Job Executes (every 10 minutes)
    ↓
Fetch observations from NDBC
    ↓
For each observation:
    ├─> UPSERT to PostgreSQL
    ├─> If new/updated:
    │       ↓
    │   Publish to Redis 'observations:new'
    │       ↓
    │   Redis forwards to all subscribers
    │       ↓
    │   Server receives message
    │       ↓
    │   Server validates message
    │       ↓
    │   Server broadcasts to all SSE clients
    │       ↓
    │   Clients receive 'observation' event
    │       ↓
    │   Clients process data (visualize, sonify, etc.)
    └─> Continue to next observation
```

### Shutdown Sequence

```
1. Server shutdown (SIGTERM/SIGINT)
   ├─> Stop accepting new SSE connections
   ├─> Send close event to existing clients (optional)
   ├─> Unsubscribe from Redis
   ├─> Close Redis connections
   └─> Exit

2. Client disconnect (user closes tab)
   ├─> TCP FIN packet sent
   ├─> Server detects 'close' event
   ├─> Remove client from ConnectionManager
   ├─> Log disconnect event
   └─> Update metrics

3. Redis failure
   ├─> Server detects Redis connection lost
   ├─> Existing SSE clients stay connected
   ├─> No new observation events sent
   ├─> Server attempts reconnection (exponential backoff)
   ├─> New SSE connections rejected (503)
   └─> When Redis recovers, new observations resume
```

---

## Monitoring & Observability

### Prometheus Metrics

```typescript
// apps/server/lib/metrics.ts

// Active SSE connections (gauge)
sse_connections_total{} = 42

// Total events sent (counter)
sse_events_sent_total{event_type="connection"} = 156
sse_events_sent_total{event_type="observation"} = 12450

// Connection duration (histogram)
sse_connection_duration_seconds{le="1"} = 5
sse_connection_duration_seconds{le="60"} = 23
sse_connection_duration_seconds{le="3600"} = 42

// Broadcast latency (histogram)
sse_broadcast_latency_ms{le="10"} = 1200
sse_broadcast_latency_ms{le="50"} = 1245
sse_broadcast_latency_ms{le="200"} = 1250
```

### Structured Logging

**Connection Event**:
```json
{
  "level": "info",
  "event": "sse_client_connected",
  "connectionCount": 5,
  "timestamp": "2024-11-16T20:00:00.000Z"
}
```

**Disconnection Event**:
```json
{
  "level": "info",
  "event": "sse_client_disconnected",
  "connectionDuration": 120500,
  "connectionCount": 4,
  "timestamp": "2024-11-16T20:02:00.000Z"
}
```

**Observation Broadcast**:
```json
{
  "level": "debug",
  "event": "observation_broadcasted",
  "stationId": "46050",
  "clientCount": 4,
  "latencyMs": 15,
  "timestamp": "2024-11-16T20:00:30.000Z"
}
```

**Redis Error**:
```json
{
  "level": "error",
  "event": "redis_connection_error",
  "error": "ECONNREFUSED 127.0.0.1:6379",
  "timestamp": "2024-11-16T20:05:00.000Z"
}
```

### Key Performance Indicators

| Metric | Target | Actual (Nov 2024) |
|--------|--------|-------------------|
| Connection event latency | <100ms | ~50ms |
| Observation event latency | <200ms | ~100-150ms |
| Concurrent clients supported | 50+ | Tested with 10 |
| Connection cleanup time | <5s | ~2-3s |
| Broadcast latency (10 clients) | <50ms | ~15ms |
| Memory per connection | <1MB | ~0.5MB |

---

## Known Limitations

### 1. Fire-and-Forget Broadcasting

**Limitation**: Events are not persisted. If client is disconnected, it misses events.

**Mitigation**: 
- Clients can query REST API for historical data
- Clients can detect gaps by checking observation timestamps

---

### 2. No Per-Client State

**Limitation**: Server doesn't track what each client has received.

**Mitigation**: 
- Stateless design enables horizontal scaling
- Clients are responsible for deduplication

---

### 3. Slow Client Handling

**Limitation**: Slow clients may miss events if TCP buffer fills.

**Mitigation**: 
- Fire-and-forget protects server memory
- Clients should ensure adequate network bandwidth

---

### 4. Browser Connection Limits

**Limitation**: Browsers limit concurrent connections per domain (typically 6-8).

**Mitigation**: 
- Use HTTP/2 (higher limits)
- Use different subdomains for different streams
- Close unused connections

---

### 5. No Message Replay

**Limitation**: Clients cannot request "last N events" on connect.

**Mitigation**: 
- SSE is for real-time only
- Use REST API for historical queries
- Combine both: query API + subscribe to stream

---

## Testing Strategy

### Unit Tests

- ConnectionManager add/remove/broadcast logic
- SSE message formatting
- Observation schema validation
- Error handling for malformed messages

### Integration Tests

- Full flow: Worker → Redis → Server → Client
- Redis failure recovery
- Client reconnection behavior
- Multiple concurrent clients

### Manual Tests

- Browser EventSource compatibility (Chrome, Firefox, Safari)
- Connection cleanup timing
- Observation event delivery latency
- Error status codes (500, 400)

### Load Tests

- 50+ concurrent connections
- High-frequency broadcasts (100+ events/sec)
- Memory usage over time
- Connection stability under load

See [test-results.md](../specs/002-realtime-stream/test-results.md) for detailed test results.

---

## Future Enhancements

### 1. Horizontal Scaling

**Current**: Single server instance

**Enhancement**: Multiple server instances behind load balancer
- All servers subscribe to same Redis channel
- Clients connected to any server receive events
- Sticky sessions NOT required (stateless)

---

### 2. Event Filtering

**Current**: All clients receive all observations from all stations

**Enhancement**: Per-client station filters
```
GET /v1/observations/stream?stationId=46050,44009
```
- Server only broadcasts matching observations to that client
- Reduces bandwidth for clients interested in specific stations

---

### 3. Compression

**Current**: Plain text SSE

**Enhancement**: Gzip compression for large observation payloads
- Reduces bandwidth
- May increase latency slightly (compression overhead)

---

### 4. Authentication

**Current**: Public endpoint (no authentication)

**Enhancement**: JWT-based authentication
```
GET /v1/observations/stream
Authorization: Bearer <jwt-token>
```
- Required for production deployment
- Rate limiting per user/API key

---

### 5. Message Replay (Optional)

**Current**: No historical playback

**Enhancement**: Send last N observations on connect
```
GET /v1/observations/stream?lastEvents=10
```
- Server buffers last N events in memory
- Sent immediately after connection event
- Helps clients avoid REST API query

---

## Troubleshooting

### Client Can't Connect

**Symptom**: Browser shows "Failed to connect" or immediate disconnect

**Check**:
1. Server is running: `curl http://localhost:3000/health`
2. Redis is running: `docker ps | grep redis`
3. CORS headers set correctly (see app.ts and observations.ts)
4. No firewall blocking port 3000

---

### No Events Received

**Symptom**: Client connected but no observation events appear

**Check**:
1. Worker is running: `docker ps` or check worker logs
2. Redis subscriber is connected: `redis-cli CLIENT LIST`
3. Observations are being inserted: Query database or check worker logs
4. Server is subscribed to correct channel: Check server startup logs

**Debug**:
```bash
# Manually publish test event
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T20:00:00.000Z","waveHeightM":3.5,"windSpeedMps":15.0,"windDirDeg":270,"waterTempC":19.0,"pressureHpa":1012.0}'

# If client receives this, Worker → Redis link is the issue
# If client doesn't receive, Server → Client link is the issue
```

---

### High Memory Usage

**Symptom**: Server memory continuously increases

**Check**:
1. Are clients disconnecting properly? Check connection count metric
2. Are dead connections being removed? Check logs for cleanup events
3. Memory leak in ConnectionManager? Run with `--inspect` and take heap snapshots

**Debug**:
```bash
# Check active connections
curl http://localhost:3000/metrics | grep sse_connections_total

# Force garbage collection (if --expose-gc flag used)
kill -SIGUSR2 <server-pid>
```

---

### Events Arrive Out of Order

**Symptom**: Observation timestamps are not chronological

**Explanation**: This can happen if:
- Worker processes multiple stations concurrently
- Multiple worker instances running
- Network jitter in Redis delivery

**Solution**: Clients should NOT assume chronological order. Sort by `timestamp` field if order matters.

---

## Code References

### Key Files

- **Server SSE Endpoint**: `apps/server/src/routes/observations.ts`
- **Connection Manager**: `apps/server/lib/sse-manager.ts`
- **Redis Subscriber**: `apps/server/lib/redis-subscriber.ts`
- **Worker Publisher**: `apps/worker/src/index.ts`
- **Observation Schema**: `apps/server/src/types.ts`

### Dependencies

- **ioredis** (^5.8.2): Redis client for Node.js
- **fastify** (^5.x): Web framework
- **zod** (^3.x): Schema validation
- **prom-client** (^15.x): Prometheus metrics

---

## Related Documentation

- [ADR 003: Server-Sent Events](./adr/003-server-sent-events.md) - Initial decision record
- [ADR 004: Redis Pub/Sub](./adr/004-redis-pubsub.md) - Worker-Server communication decision
- [Spec 002: Real-Time Streaming](../specs/002-realtime-stream/spec.md) - Feature specification
- [API.md](./API.md) - SSE endpoint documentation
- [Test Results](../specs/002-realtime-stream/test-results.md) - Testing outcomes

---

## Maintenance Notes

### When to Restart

**Server**: 
- After code changes (hot reload in dev)
- After configuration changes
- If Redis subscriber loses connection and doesn't recover

**Worker**:
- After code changes (hot reload in dev)
- After configuration changes
- If BullMQ jobs are stuck

**Redis**:
- Very rarely (stable infrastructure)
- Losing Redis does NOT lose database data (persistent)
- Clients will reconnect automatically

### Monitoring in Production

**Key Alerts**:
1. SSE connection count drops to 0 (potential server issue)
2. Broadcast latency >200ms (performance degradation)
3. Redis subscriber disconnected >60s (infrastructure issue)
4. Invalid message rate >1% (data quality issue)

**Dashboards**:
- SSE connection count over time
- Event delivery latency (p50, p95, p99)
- Connection duration histogram
- Redis pub/sub message rate

---

**Last Updated**: November 16, 2024  
**Maintained By**: Tyler Sargent  
**Questions?** See [API.md](./API.md) or open an issue.
