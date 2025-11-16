# Architecture Clarification: Worker-to-Server Communication

## Current Architecture (Spec 002 Gap)

```
┌─────────────────┐
│  NDBC API       │
│  (noaa.gov)     │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐      ┌─────────────┐
│  Worker         │◄────►│  Redis      │
│  (BullMQ jobs)  │      │  (Job Queue)│
└────────┬────────┘      └─────────────┘
         │
         │ Prisma
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  (Observations) │
└─────────────────┘

         ❌ MISSING LINK ❌
         
┌─────────────────┐
│  Server         │──────► Browser Clients
│  (SSE Endpoint) │        (EventSource)
└─────────────────┘
```

**Problem**: How does the server know when the worker has inserted new observations?

---

## Recommended Solution: Redis Pub/Sub

```
┌─────────────────┐
│  NDBC API       │
│  (noaa.gov)     │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐      ┌─────────────────────┐
│  Worker         │◄────►│  Redis              │
│  (BullMQ jobs)  │      │  • Job Queue        │
│                 │      │  • Pub/Sub Channel  │
│  1. Fetch data  │      │                     │
│  2. Parse       │      └──────────┬──────────┘
│  3. Insert DB   │                 │
│  4. PUBLISH     ├─────────────────┘
│     "obs:new"   │      (Publish to channel)
└─────────────────┘
         │
         │ Prisma
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  (Observations) │
└─────────────────┘

         │
         │ SUBSCRIBE to "obs:new"
         ▼
         
┌─────────────────┐      ┌──────────────────┐
│  Server         │      │  Browser Client  │
│  (SSE Endpoint) │      │  (EventSource)   │
│                 │      │                  │
│  1. SUBSCRIBE   │      │  1. Connect      │
│  2. Receive msg │      │  2. Receive SSE  │
│  3. Broadcast   ├─────►│  3. Sonify!      │
│     to clients  │ SSE  │                  │
└─────────────────┘      └──────────────────┘
```

### Flow

1. **Worker ingests observation**:
   ```typescript
   await prisma.observation.upsert({...});
   
   // Publish event
   await redis.publish('observations:new', JSON.stringify({
     stationId: '44009',
     timestamp: '2025-11-15T12:00:00.000Z',
     waveHeightM: 1.2,
     // ... other fields
   }));
   ```

2. **Server subscribes on startup**:
   ```typescript
   const subscriber = redis.duplicate();
   await subscriber.subscribe('observations:new');
   
   subscriber.on('message', (channel, message) => {
     const observation = JSON.parse(message);
     broadcastToAllSSEClients(observation);
   });
   ```

3. **Clients receive via SSE**:
   ```javascript
   const eventSource = new EventSource('/v1/observations/stream');
   eventSource.addEventListener('observation', (event) => {
     const obs = JSON.parse(event.data);
     synthesizeAudio(obs);
   });
   ```

---

## Alternative Approaches Considered

### ❌ Option 1: Database Polling

```
Server polls database every 5 seconds:
  SELECT * FROM observations WHERE createdAt > lastPoll
```

**Why NOT recommended**:
- Adds 5s latency (does not meet 200ms requirement)
- Increases database load
- Inefficient for low-frequency updates

---

### ❌ Option 2: Shared Event Emitter (In-Process)

```
Worker and Server share EventEmitter in same process
```

**Why NOT recommended**:
- Breaks architectural separation
- Cannot scale horizontally (multiple workers/servers)
- Requires monolithic deployment

---

### ❌ Option 3: HTTP Webhook

```
Worker → HTTP POST → Server
```

**Why NOT recommended**:
- Requires server to expose internal HTTP endpoint
- Adds complexity (authentication, retries)
- Less reliable than Redis Pub/Sub

---

## Benefits of Redis Pub/Sub

✅ **Low Latency**: < 1ms message delivery  
✅ **Horizontal Scaling**: Multiple servers can subscribe  
✅ **Existing Infrastructure**: Redis already in use (BullMQ)  
✅ **Simple**: Native support in `ioredis` library  
✅ **Reliable**: At-most-once delivery (acceptable for real-time stream)  

---

## Implementation Checklist

### Worker Changes
- [ ] Create Redis client for publishing (separate from BullMQ)
- [ ] Publish to `observations:new` after successful upsert
- [ ] Include all observation fields in message payload

### Server Changes
- [ ] Create Redis subscriber client on startup
- [ ] Subscribe to `observations:new` channel
- [ ] Implement connection registry (Set of response objects)
- [ ] Broadcast messages to all SSE clients
- [ ] Clean up disconnected clients

### Testing
- [ ] Unit: Redis pub/sub message format
- [ ] Integration: Worker publishes → Server receives
- [ ] E2E: Worker → Server → Browser client receives observation
- [ ] Load: 10 concurrent clients receive identical events

---

## Redis Pub/Sub Message Format

**Channel**: `observations:new`

**Payload** (JSON):
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

**SSE Format** (sent to clients):
```
event: observation
data: {"stationId":"44009","timestamp":"2025-11-15T12:00:00.000Z","waveHeightM":1.2,"windSpeedMps":5.1,"windDirDeg":180,"waterTempC":12.4,"pressureHpa":1012.8}

```

---

## Questions?

1. **Q**: What if Redis goes down?  
   **A**: Worker jobs will fail (BullMQ already depends on Redis). SSE clients won't receive events but can reconnect when Redis recovers.

2. **Q**: Can we use Redis Streams instead of Pub/Sub?  
   **A**: Yes, but adds complexity (consumer groups, acking). Pub/Sub is simpler for broadcast use case.

3. **Q**: Should we persist messages for offline clients?  
   **A**: No for MVP. Clients can query REST API for missed data. Consider Redis Streams post-MVP if needed.

---

## Next Step

**Decision Required**: Approve Redis Pub/Sub approach before updating spec and creating implementation plan.
