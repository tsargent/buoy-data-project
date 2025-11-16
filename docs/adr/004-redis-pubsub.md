# ADR 004: Use Redis Pub/Sub for Worker-to-Server Communication

**Status**: Accepted  
**Date**: 2024-11-16  
**Deciders**: Tyler Sargent  
**Technical Story**: Real-time observation broadcasting from Worker to Server  
**Supersedes**: None  
**Related**: [ADR 003 (Server-Sent Events)](./003-server-sent-events.md)

## Context and Problem Statement

The Worker and Server are **separate processes** (potentially on different machines). When the Worker ingests new buoy observations from NDBC and stores them in PostgreSQL, it needs to notify the Server so that the Server can push those observations to connected SSE clients in real-time.

**Key Requirements**:
- Worker and Server processes are decoupled (separate deployments)
- Worker should not need to know about Server instances or their locations
- Server may have multiple instances (horizontal scaling)
- Communication must be fast (<100ms latency)
- Messages are ephemeral (real-time streaming, not persistent queue)
- Already have Redis infrastructure for BullMQ job queue

## Decision Drivers

- **Decoupling**: Worker should not depend on Server availability or location
- **Horizontal Scaling**: Support multiple Server instances receiving same events
- **Low Latency**: Real-time streaming requires fast message delivery
- **Infrastructure Reuse**: Leverage existing Redis installation
- **Simplicity**: Minimal configuration and code
- **Fire-and-Forget**: No need for guaranteed delivery (REST API provides historical data)
- **Constitution Alignment**: "Infrastructure Pragmatism" (2.8) - use existing tools

## Considered Options

1. **Redis Pub/Sub** - Publish-subscribe messaging via Redis channels
2. **Database Polling** - Server queries database periodically for new observations
3. **HTTP Webhooks** - Worker POSTs to Server HTTP endpoint
4. **Shared EventEmitter** - In-process event bus (Node.js EventEmitter)
5. **Message Queue** (RabbitMQ, Kafka, AWS SQS) - Dedicated message broker

## Decision Outcome

**Chosen option**: Redis Pub/Sub

Worker publishes observation messages to Redis channel `observations:new`. Server subscribes to this channel and broadcasts received messages to all connected SSE clients.

### Implementation

**Worker side** (`apps/worker/src/index.ts`):
```typescript
import Redis from 'ioredis';

const redis = new Redis(env.REDIS_URL);

// After successful database insert
await prisma.observation.upsert({ /* ... */ });

// Publish to Redis channel
await redis.publish('observations:new', JSON.stringify({
  stationId: observation.stationId,
  timestamp: observation.observedAt.toISOString(),
  waveHeightM: observation.waveHeightM,
  windSpeedMps: observation.windSpeedMps,
  windDirDeg: observation.windDirDeg,
  waterTempC: observation.waterTempC,
  pressureHpa: observation.pressureHpa
}));
```

**Server side** (`apps/server/lib/redis-subscriber.ts`):
```typescript
import Redis from 'ioredis';

const subscriber = new Redis(env.REDIS_URL);

// Subscribe to channel
await subscriber.subscribe('observations:new');

subscriber.on('message', (channel, message) => {
  if (channel === 'observations:new') {
    const observation = JSON.parse(message);
    
    // Validate schema
    const validated = ObservationSchema.parse(observation);
    
    // Broadcast to all SSE clients
    connectionManager.broadcastToAll('observation', validated);
  }
});
```

### Positive Consequences

- ✅ **Complete Decoupling**: Worker doesn't know about Server (no URL, no endpoints)
- ✅ **Horizontal Scaling**: Multiple Server instances can subscribe to same channel
- ✅ **Low Latency**: Redis Pub/Sub delivers messages in <10ms
- ✅ **Infrastructure Reuse**: Already have Redis for BullMQ (no new dependencies)
- ✅ **Simple Implementation**: ~20 lines of code on each side
- ✅ **Fire-and-Forget**: No acknowledgment needed, matches SSE semantics
- ✅ **No Persistence Overhead**: Messages not stored (appropriate for real-time stream)
- ✅ **Easy Testing**: Can manually publish via `redis-cli` for debugging

### Negative Consequences

- ⚠️ **Redis Dependency**: System requires Redis to be running for real-time updates
- ⚠️ **No Message Persistence**: If Server is down, messages are lost
- ⚠️ **No Delivery Guarantee**: Fire-and-forget means no confirmation of receipt
- ⚠️ **Separate Connection Required**: Redis Pub/Sub needs dedicated client connection

### Mitigation Strategies

**Redis Dependency**:
- Redis already required for BullMQ (job queue), so no new dependency
- Docker Compose makes Redis setup trivial for local development
- Production environments typically have managed Redis (AWS ElastiCache, etc.)

**No Message Persistence**:
- Acceptable for real-time streaming use case
- Database stores all observations (source of truth)
- Clients can query REST API for historical data
- SSE is for "live updates only", not data delivery guarantee

**No Delivery Guarantee**:
- Appropriate for SSE semantics (clients can disconnect anytime)
- Worker continues to store observations in database regardless
- Clients are responsible for handling disconnections and gaps

## Pros and Cons of Other Options

### Database Polling

**Description**: Server queries database every N seconds for new observations

```typescript
setInterval(async () => {
  const newObservations = await prisma.observation.findMany({
    where: { createdAt: { gt: lastCheck } }
  });
  // Broadcast to SSE clients
}, 5000); // Check every 5 seconds
```

**Pros**:
- ✅ No additional infrastructure (just database)
- ✅ No Redis dependency
- ✅ Simple to understand

**Cons**:
- ❌ High latency (poll interval = minimum delay, e.g., 5s)
- ❌ Database load (constant queries even when no new data)
- ❌ Inefficient (queries run regardless of new data availability)
- ❌ Scales poorly (N servers = N polling queries)
- ❌ Complexity (tracking "last checked" timestamp per server)

**Why not chosen**: Poor latency and inefficient resource usage

---

### HTTP Webhooks

**Description**: Worker POSTs new observation to Server HTTP endpoint

```typescript
// Worker
await fetch('http://server:3000/internal/observations', {
  method: 'POST',
  body: JSON.stringify(observation)
});
```

**Pros**:
- ✅ No Redis dependency
- ✅ Direct communication (clear flow)
- ✅ HTTP-based (familiar protocol)

**Cons**:
- ❌ Tight coupling (Worker needs to know Server URL)
- ❌ Single server only (Worker must track multiple Server IPs for scaling)
- ❌ Synchronous (Worker must wait for HTTP response)
- ❌ Error handling complexity (retry logic, timeouts)
- ❌ Service discovery needed (how does Worker find Server instances?)
- ❌ Network failures block Worker (if Server is down)

**Why not chosen**: Tight coupling and doesn't support horizontal scaling

---

### Shared EventEmitter

**Description**: In-process Node.js EventEmitter for communication

```typescript
// Shared emitter
import { EventEmitter } from 'events';
const emitter = new EventEmitter();

// Worker emits
emitter.emit('observation', data);

// Server listens
emitter.on('observation', (data) => {
  // Broadcast to SSE clients
});
```

**Pros**:
- ✅ Extremely fast (in-process)
- ✅ No external dependencies
- ✅ Simple API

**Cons**:
- ❌ **Only works in same Node.js process** (fatal flaw)
- ❌ Cannot support separate Worker and Server deployments
- ❌ No horizontal scaling (can't share EventEmitter across processes)
- ❌ Tight coupling (Worker and Server in same codebase)

**Why not chosen**: Requires Worker and Server in same process (violates separation principle)

---

### Message Queue (RabbitMQ, Kafka, AWS SQS)

**Description**: Dedicated message broker with guaranteed delivery

**Pros**:
- ✅ Guaranteed delivery (messages persisted)
- ✅ Message acknowledgment (know when consumed)
- ✅ Horizontal scaling support
- ✅ Advanced features (dead letter queues, routing, etc.)

**Cons**:
- ❌ Overkill for this use case (don't need guaranteed delivery)
- ❌ Additional infrastructure (RabbitMQ/Kafka cluster)
- ❌ Operational complexity (monitoring, maintenance)
- ❌ Higher latency than Pub/Sub (persistence overhead)
- ❌ More code (connection management, ACKs, error handling)
- ❌ Cost (managed services like AWS SQS)

**Why not chosen**: Unnecessary complexity for fire-and-forget real-time streaming

---

## Decision Rationale

### Why Redis Pub/Sub is the Best Fit

1. **Already Have Redis**: Infrastructure exists for BullMQ, no new dependency
2. **Matches Use Case**: Fire-and-forget semantics align with SSE streaming
3. **Performance**: <10ms latency meets real-time requirements
4. **Decoupling**: Worker and Server are completely independent
5. **Horizontal Scaling**: Multiple Server instances work naturally
6. **Simplicity**: Minimal code, easy to understand and test

### Alignment with Project Principles

From [Constitution](../../.specify/memory/constitution.md):

- **2.4 Simplicity & Decomposition**: Redis Pub/Sub is simpler than message queues
- **2.8 Infrastructure Pragmatism**: Reuses existing Redis infrastructure
- **2.11 Progressive Enhancement**: Can add message queue later if guaranteed delivery needed

### Trade-offs We Accept

We **accept** that messages are not persisted because:
- **Database is source of truth**: All observations stored in PostgreSQL
- **REST API provides history**: Clients can query `/v1/observations/by-station/:id`
- **SSE is real-time only**: Designed for live updates, not data delivery guarantee
- **Clients handle gaps**: Can detect missing observations via timestamps

We **accept** Redis as a dependency because:
- Already required for BullMQ (not a new dependency)
- Redis is extremely stable and widely deployed
- Fallback exists (REST API polling if Redis down)

---

## Implementation Notes

### Channel Naming

**Channel**: `observations:new`

**Rationale**: 
- Descriptive and unambiguous
- Namespaced for future expansion (e.g., `observations:updated`, `stations:new`)
- Lowercase with colon separator (Redis convention)

### Message Format

**Schema** (JSON):
```typescript
{
  stationId: string;      // e.g., "46050"
  timestamp: string;      // ISO 8601: "2024-11-16T20:00:00.000Z"
  waveHeightM: number | null;
  windSpeedMps: number | null;
  windDirDeg: number | null;
  waterTempC: number | null;
  pressureHpa: number | null;
}
```

**Validation**: Server uses Zod schema to validate messages before broadcasting to clients

### Error Handling

**Worker side**:
- Wrap `redis.publish()` in try/catch
- Log errors but don't throw (don't fail database insert if Redis is down)
- Retry transient errors (connection issues) up to 3 times

**Server side**:
- Validate message schema before broadcasting
- Log invalid messages but don't crash server
- Auto-reconnect to Redis if connection lost (ioredis default behavior)

### Testing

**Manual Testing**:
```bash
# Publish test observation
redis-cli PUBLISH observations:new '{
  "stationId": "46050",
  "timestamp": "2024-11-16T20:00:00.000Z",
  "waveHeightM": 3.5,
  "windSpeedMps": 15.0,
  "windDirDeg": 270,
  "waterTempC": 19.0,
  "pressureHpa": 1012.0
}'
```

**Integration Testing**:
- Start Redis, Server, and Worker
- Trigger Worker to fetch data
- Verify Server receives Redis messages
- Verify SSE clients receive events
- Measure end-to-end latency (target <200ms)

---

## Alternatives for Future Consideration

If requirements change, we might consider:

### Kafka / RabbitMQ (If Guaranteed Delivery Needed)

**When**: If clients need 100% delivery guarantee and can't tolerate missed events

**Trade-off**: Much higher operational complexity for minimal benefit

---

### Apache Pulsar (If Multi-Tenancy Needed)

**When**: If we need separate streams per user/organization with access control

**Trade-off**: Overkill for current scale (5 stations, <1000 clients expected)

---

### NATS (If Lower Latency Needed)

**When**: If we need <5ms latency (unlikely for ocean observations)

**Trade-off**: Another infrastructure component to manage

---

## Monitoring and Metrics

### Key Metrics

- **Publish Rate**: `redis_publishes_total` (counter)
- **Publish Latency**: `redis_publish_duration_ms` (histogram)
- **Publish Errors**: `redis_publish_errors_total` (counter)
- **Subscriber Connection Status**: `redis_subscriber_connected` (gauge)
- **Messages Received**: `redis_messages_received_total` (counter)
- **Invalid Messages**: `redis_invalid_messages_total` (counter)

### Alerts

- **Redis Subscriber Disconnected** >60s: Server can't receive messages
- **Publish Error Rate** >5%: Worker having trouble reaching Redis
- **Invalid Message Rate** >1%: Data quality issue

---

## Related Documentation

- [ADR 003: Server-Sent Events](./003-server-sent-events.md) - SSE implementation
- [ADR 002: BullMQ Job Queue](./002-bullmq-job-queue.md) - Redis usage for jobs
- [SSE Implementation Guide](../SSE_IMPLEMENTATION.md) - Detailed architecture
- [Spec 002: Real-Time Streaming](../../specs/002-realtime-stream/spec.md) - Feature spec

---

## Consequences

### Short Term

- ✅ Rapid implementation (completed in 1 day)
- ✅ Easy to test and debug (redis-cli for manual testing)
- ✅ No new infrastructure to deploy

### Long Term

- ✅ Supports horizontal scaling (add more Server instances)
- ✅ Worker and Server remain decoupled (independent deployment)
- ⚠️ Redis becomes critical path (if Redis down, no real-time updates)
- ⚠️ Need monitoring for Redis Pub/Sub health

### If We Need to Change Later

**Easy to migrate to message queue** because:
- Worker publishing code is isolated (one file)
- Server subscription code is isolated (one file)
- Interface is simple (publish message, receive message)
- ~2 hours to swap Redis Pub/Sub for RabbitMQ if needed

---

**Last Updated**: November 16, 2024  
**Status**: Implemented and tested  
**Next Review**: When horizontal scaling is needed or Redis becomes bottleneck
