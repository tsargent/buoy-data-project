# Analysis: Real-Time Buoy Data Streaming Specification

**Feature**: Real-Time Buoy Data Streaming  
**Spec Version**: Draft  
**Analysis Date**: 2025-11-15  
**Analyst**: GitHub Copilot

## Executive Summary

This analysis evaluates the completeness and clarity of the Real-Time Buoy Data Streaming specification. The spec is **well-defined and implementation-ready** with strong alignment to existing architectural decisions (ADR 003: Server-Sent Events). Minor clarifications are recommended around the event broadcasting mechanism between worker and server.

**Overall Assessment**: ✅ READY FOR IMPLEMENTATION

## Specification Strengths

### 1. Clear User Value Proposition
- Well-defined user stories with independent test criteria
- Appropriate priority levels (P1: MVP, P2: Multi-client, P3: Connection handling)
- Each story clearly states "why this priority" and "independent test" criteria

### 2. Comprehensive Requirements
- 10 functional requirements (FR-001 through FR-010) covering endpoint, events, format, headers, cleanup, concurrency, latency, and compatibility
- Requirements are testable and technology-agnostic (focuses on SSE protocol rather than implementation)
- All fields specified match existing database schema (Observation model)

### 3. Measurable Success Criteria
- 6 success criteria with specific metrics (100ms connection, 200ms event delivery, 10 concurrent clients, 5s cleanup)
- Criteria focus on user-observable outcomes rather than implementation details

### 4. Alignment with Architecture
- Consistent with ADR 003 (Server-Sent Events)
- Builds on existing Redis infrastructure (ADR 002: BullMQ)
- Event schema matches PRD section 8 and AUDIO_CLIENTS.md documentation

## Questions and Clarifications

### Critical Questions (Must Resolve Before Implementation)

#### Q1: Worker-to-Server Event Broadcasting Mechanism
**Issue**: The spec states "System MUST broadcast new observation events to all connected clients whenever the worker processes and stores new buoy data" (FR-003), but the mechanism for worker-to-server communication is not specified.

**Context**: 
- Worker runs in separate process (`apps/worker`)
- Server runs in separate process (`apps/server`)
- Both have access to Redis (used for BullMQ)
- ADR 003 mentions "future: event emitter or Redis pub/sub"

**Options**:
1. **Redis Pub/Sub** (Recommended)
   - Worker publishes to Redis channel after successful upsert
   - Server subscribes to channel and broadcasts to SSE clients
   - Pros: Decoupled, supports multiple server instances, leverages existing Redis
   - Cons: Additional Redis connection overhead

2. **Database Polling**
   - Server polls database for new observations
   - Pros: No additional infrastructure
   - Cons: Higher latency, increased database load, does not meet 200ms requirement (FR-009)

3. **Shared Event Emitter**
   - In-process event emitter (Node.js EventEmitter)
   - Pros: Zero latency
   - Cons: Only works in monolithic deployment, breaks with multiple workers/servers

**Recommendation**: Use **Redis Pub/Sub** to maintain architectural separation and support horizontal scaling.

**Spec Impact**: Add to FR-003: "System MUST use a broadcast mechanism (such as Redis Pub/Sub) to notify the server when new observations are stored by the worker."

---

#### Q2: Event Delivery Guarantee During High Volume
**Issue**: What happens when the worker processes observations faster than clients can consume them?

**Scenarios**:
- Worker processes 50 observations in 1 second
- Client connection is slow (mobile network)
- Multiple stations report simultaneously

**Options**:
1. **Fire-and-Forget** (Recommended for MVP)
   - Send all events to all clients, no buffering
   - Slow clients may drop events if TCP buffer fills
   - Aligns with SSE model (unidirectional push)

2. **Per-Client Buffering**
   - Buffer events for slow clients
   - Risk: Memory leak if client never disconnects properly
   - Complex: Requires backpressure handling

3. **Rate Limiting**
   - Throttle events sent to individual clients
   - Risk: Clients miss important observations

**Recommendation**: Use **Fire-and-Forget** for MVP. Document as edge case: "Clients on slow connections may miss events during high-volume periods."

**Spec Impact**: Add to Edge Cases: "What happens when the worker processes observations faster than a client can receive them? The system uses a fire-and-forget model; slow clients may miss events if their TCP receive buffer fills. Clients should implement reconnection logic to catch up."

---

### Medium Priority Questions (Can Resolve During Implementation)

#### Q3: Connection Event Format
**Issue**: FR-002 states "System MUST send a connection event immediately upon client connection" but does not specify the event format.

**Current State**: ADR 003 shows example: `sendEvent({ type: "connected", timestamp: new Date().toISOString() })`

**Recommendation**: Standardize connection event format:
```
event: connection
data: {"status":"connected","timestamp":"2025-11-15T12:00:00.000Z"}
```

**Spec Impact**: Add to FR-002: "The connection event MUST use event type 'connection' and include JSON data with fields: status ('connected') and timestamp (ISO 8601)."

---

#### Q4: Error Handling for SSE Endpoint
**Issue**: Edge case mentions "What happens when database queries fail during stream initialization?" but no functional requirement covers error responses.

**Scenarios**:
- Database connection fails
- Redis connection fails (for pub/sub)
- Client connects with invalid headers

**Recommendation**: Add functional requirement:
- **FR-011**: System MUST respond with HTTP 500 and close the connection if initialization fails (database/Redis unavailable)
- **FR-012**: System MUST respond with HTTP 400 if client sends invalid SSE request headers

**Spec Impact**: Add FR-011 and FR-012, update Edge Cases with specific HTTP status codes.

---

#### Q5: Observation Event Deduplication
**Issue**: What happens if the same observation is processed multiple times by the worker (e.g., worker restart, retry logic)?

**Current State**: Worker uses `upsert` with unique constraint `stationId_observedAt`, so database prevents duplicates.

**Question**: Should the server deduplicate events sent to SSE clients, or is it acceptable to send duplicate events?

**Options**:
1. **No Deduplication** (Recommended)
   - Trust worker's upsert logic
   - Simpler server implementation
   - Clients can deduplicate if needed (based on stationId + timestamp)

2. **Server-Side Deduplication**
   - Track recently sent observations (cache last N)
   - Adds complexity and memory overhead

**Recommendation**: **No Deduplication** at server level. Document in Edge Cases.

**Spec Impact**: Add to Edge Cases: "What happens if the worker processes the same observation multiple times? The server may send duplicate events to clients. Clients should deduplicate based on stationId and timestamp if necessary."

---

### Low Priority Questions (Nice to Have)

#### Q6: Heartbeat Events
**Issue**: Long-lived connections may be closed by proxies/load balancers without activity.

**Current State**: Not mentioned in spec.

**Recommendation**: Consider adding heartbeat events (e.g., every 30 seconds) to keep connections alive:
```
event: heartbeat
data: {"timestamp":"2025-11-15T12:00:00.000Z"}
```

**Spec Impact**: Optional enhancement, can defer to post-MVP.

---

#### Q7: Client Reconnection Window
**Issue**: User Story 3 mentions "browser automatically attempts to reconnect" but doesn't specify behavior for observations missed during disconnection.

**Current State**: EventSource API handles reconnection automatically with `Last-Event-ID` header, but server doesn't implement event IDs.

**Options**:
1. **No Catch-Up** (Recommended for MVP)
   - Client reconnects and receives new events only
   - Simpler implementation

2. **Event ID + Catch-Up**
   - Server assigns sequential IDs to events
   - Client sends `Last-Event-ID` on reconnect
   - Server sends missed events
   - Complex: Requires event buffering

**Recommendation**: **No Catch-Up** for MVP. Clients that need historical data can query `/v1/observations/by-station/:stationId`.

**Spec Impact**: Update User Story 3, Scenario 3: "Given a client reconnects after disconnection, When new observations are processed, Then the client receives observation events as if it were a new connection (no catch-up of missed events)."

---

## Alignment Check

### ✅ Alignment with Existing Architecture

| Component | Alignment | Notes |
|-----------|-----------|-------|
| **ADR 003 (SSE)** | ✅ Perfect | Spec fully implements SSE decision |
| **ADR 002 (BullMQ)** | ✅ Good | Worker uses BullMQ for ingestion, needs pub/sub for events |
| **PRD Section 8** | ✅ Perfect | Event format matches PRD schema exactly |
| **AUDIO_CLIENTS.md** | ✅ Perfect | Spec uses `/v1/observations/stream`, event type "observation" |
| **Database Schema** | ✅ Perfect | All fields match Observation model |

### ✅ Compliance with Non-Functional Requirements

| Requirement | Target | Spec Alignment |
|-------------|--------|----------------|
| **Real-time latency** | < 200ms | SC-002: ✅ 200ms delivery time |
| **Ingestion + processing** | < 1 second | Not applicable (worker concern) |
| **Horizontal scaling** | Multiple workers | ⚠️ Needs Redis Pub/Sub clarification |
| **Minimal surface area** | Simple API | ✅ Single GET endpoint |

---

## Implementation Considerations

### Dependencies
1. **Redis Client** (additional connection for pub/sub)
   - Server needs Redis client for subscribing
   - Worker already has Redis via BullMQ

2. **SSE Response Handling** (Fastify)
   - Must bypass Fastify's response serialization
   - Use `reply.raw` for SSE format

3. **Connection Registry**
   - Track active SSE connections for broadcasting
   - Clean up on disconnect (FR-007)

### Testing Strategy
Per User Story priorities:

**P1 Testing** (Basic Streaming):
- Unit: SSE endpoint returns correct headers
- Integration: Worker emits event → Server receives → Client receives
- E2E: Browser EventSource connects and receives observation

**P2 Testing** (Multiple Clients):
- Load: 10 concurrent clients receive identical events
- Stress: 100 concurrent clients (verify no data loss)

**P3 Testing** (Connection Handling):
- Chaos: Kill client, verify server cleans up
- Network: Disconnect network, verify EventSource reconnects

### Performance Considerations
- **Memory**: Each SSE connection holds response object. Estimate 1-5KB per connection. 1000 clients ≈ 1-5MB.
- **CPU**: Broadcasting to N clients = O(N) writes per event. Not a concern until 1000+ clients.
- **Redis**: Pub/Sub adds minimal overhead (< 1ms per message).

---

## Recommended Specification Updates

### High Priority Additions

1. **Add FR-011**: "System MUST respond with HTTP 500 and close the connection if Redis or database initialization fails during stream setup."

2. **Add FR-012**: "System MUST respond with HTTP 400 if the client request is missing required SSE headers (Accept: text/event-stream)."

3. **Clarify FR-003**: "System MUST use Redis Pub/Sub (or equivalent broadcast mechanism) to notify the server when new observations are stored by the worker, enabling event delivery to all connected clients."

4. **Expand Connection Event (FR-002)**:
   ```
   event: connection
   data: {"status":"connected","timestamp":"2025-11-15T12:00:00.000Z"}
   ```

### Medium Priority Additions

5. **Add Edge Case**: "What happens when the worker processes observations faster than a client can receive them? The system uses a fire-and-forget broadcast model; slow clients may miss events if their TCP receive buffer fills. Clients should monitor for gaps in observation timestamps."

6. **Add Edge Case**: "What happens if the worker processes the same observation multiple times? The server may send duplicate observation events to clients. Clients can deduplicate using stationId + timestamp as a composite key."

7. **Update User Story 3, Scenario 3**: Clarify that reconnection does NOT include catch-up of missed events. Clients needing historical data should query the REST API.

### Low Priority (Post-MVP)

8. **Consider Heartbeat Events**: Add optional heartbeat every 30-60 seconds to prevent proxy timeouts.

9. **Consider Event IDs**: Implement SSE event IDs for client-driven catch-up after reconnection.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|---------|------------|
| **Missing worker-server broadcast** | High | High | Add Redis Pub/Sub (Q1) |
| **Slow clients block others** | Medium | Low | Fire-and-forget model (Q2) |
| **Proxy closes idle connections** | Medium | Medium | Add heartbeat (Q6) |
| **Multiple workers send duplicates** | Low | Low | Document client-side dedup (Q5) |
| **High concurrency memory leak** | Low | Medium | Proper disconnect cleanup (FR-007) |

---

## Acceptance Checklist

Before marking spec as "Ready for Planning":

- [ ] Resolve Q1: Add Redis Pub/Sub mechanism to FR-003
- [ ] Resolve Q2: Document fire-and-forget model in Edge Cases
- [ ] Resolve Q3: Standardize connection event format in FR-002
- [ ] Resolve Q4: Add FR-011 and FR-012 for error handling
- [ ] Update checklist: Add new functional requirements to `checklists/requirements.md`
- [ ] Review with stakeholders: Confirm no catch-up needed for reconnection (Q7)

---

## Next Steps

1. **Update Specification**: Incorporate high-priority additions (FR-011, FR-012, clarify FR-003)
2. **Plan Implementation**: Create `plan.md` with Redis Pub/Sub architecture
3. **Create Tasks**: Break down into tasks in `tasks.md`
4. **Validate with Team**: Review Q1 (Redis Pub/Sub) and Q2 (fire-and-forget) decisions

---

## References

- [Spec 002](./spec.md)
- [ADR 003: Server-Sent Events](../../docs/adr/003-server-sent-events.md)
- [ADR 002: BullMQ Job Queue](../../docs/adr/002-bullmq-job-queue.md)
- [PRD: Real-Time Stream](../../docs/PRD.md#7-data-flow)
- [Audio Clients Guide](../../docs/AUDIO_CLIENTS.md)
- [Database Schema](../../apps/server/prisma/schema.prisma)
