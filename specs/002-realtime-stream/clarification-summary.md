# Spec 002 Clarification Summary

**Date**: 2025-11-15  
**Status**: Clarifications Required  
**Priority**: High

## TL;DR

Spec 002 (Real-Time Buoy Data Streaming) is **90% complete** and well-structured. The primary gap is the **worker-to-server event broadcasting mechanism**. Recommend adding Redis Pub/Sub before proceeding to implementation.

---

## Critical Clarifications Needed

### 1. ⚠️ Worker-to-Server Communication (MUST RESOLVE)

**Problem**: The spec requires broadcasting new observations from worker to server, but doesn't specify the mechanism.

**Current State**:
- Worker runs in separate process (`apps/worker`)
- Server runs in separate process (`apps/server`)
- Both have Redis access (BullMQ)

**Recommended Solution**: **Redis Pub/Sub**
- Worker publishes to `observations:new` channel after successful database insert
- Server subscribes to channel and broadcasts to SSE clients
- Supports multiple server instances (horizontal scaling)
- Leverages existing Redis infrastructure

**Action Required**: Add to FR-003:
> "System MUST use Redis Pub/Sub to notify the server when new observations are stored by the worker. Worker publishes to `observations:new` channel; server subscribes and broadcasts to connected SSE clients."

---

### 2. ⚠️ High-Volume Event Handling (SHOULD CLARIFY)

**Problem**: What happens when worker processes observations faster than clients can consume?

**Scenarios**:
- Worker processes 50 observations in 1 second during bulk ingestion
- Client on slow mobile connection
- Multiple stations report simultaneously

**Recommended Approach**: **Fire-and-Forget**
- Send all events to all clients immediately
- No per-client buffering
- Slow clients may miss events (SSE standard behavior)
- Clients can query REST API for missed data

**Action Required**: Add to Edge Cases:
> "What happens when the worker processes observations faster than a client can receive them? The system uses a fire-and-forget broadcast model. Clients on slow connections may miss events if their TCP receive buffer fills. Clients should monitor observation timestamps for gaps and query the REST API (`/v1/observations/by-station/:stationId`) to fill missing data."

---

## Medium Priority Clarifications

### 3. Connection Event Format

**Current**: FR-002 requires connection event but format is unspecified  
**Recommendation**: Standardize as:
```
event: connection
data: {"status":"connected","timestamp":"2025-11-15T12:00:00.000Z"}
```

### 4. Error Responses

**Missing**: HTTP status codes for error scenarios  
**Recommendation**: Add:
- **FR-011**: HTTP 500 if Redis/database unavailable during initialization
- **FR-012**: HTTP 400 if client sends invalid request headers

---

## Low Priority (Can Defer)

### 5. Heartbeat Events
- Add periodic heartbeat (every 30-60s) to prevent proxy timeouts
- Optional for MVP, add post-launch

### 6. Event Deduplication
- Worker's `upsert` prevents database duplicates
- Server may send duplicate events if worker retries
- Clients can deduplicate using `stationId + timestamp`
- Document in Edge Cases

### 7. Reconnection Catch-Up
- User Story 3 mentions reconnection but not catch-up behavior
- Recommendation: **No catch-up** for MVP (clients reconnect and receive new events only)
- Clients needing history should query REST API

---

## Specification Strengths

✅ Well-defined user stories with clear priorities (P1/P2/P3)  
✅ Comprehensive functional requirements (FR-001 to FR-010)  
✅ Measurable success criteria with specific metrics  
✅ Perfect alignment with ADR 003 (Server-Sent Events)  
✅ Event schema matches existing database and PRD  
✅ Edge cases identified

---

## Recommended Actions

### Before Implementation

1. **Update Spec** with clarifications 1-4 above
2. **Review with Team** Redis Pub/Sub approach (confirm architecture decision)
3. **Update Requirements Checklist** to include FR-011 and FR-012

### During Implementation

4. **Create ADR 004** documenting Redis Pub/Sub decision (if approved)
5. **Add Integration Tests** for worker → Redis → server flow
6. **Document Client Behavior** in AUDIO_CLIENTS.md (deduplication, gaps)

### Post-MVP

7. **Consider Heartbeat** if proxy timeouts observed in production
8. **Consider Event IDs** if clients need catch-up after reconnection
9. **Monitor Metrics** for slow clients dropping events

---

## Questions for Stakeholders

1. **Q1**: Confirm Redis Pub/Sub is acceptable architecture (vs. alternatives like database polling)?
2. **Q2**: Acceptable for clients to miss events during high volume, or do we need per-client buffering?
3. **Q7**: Do clients need to catch up on missed events after reconnection, or is "new events only" sufficient?

---

## Next Steps

1. ✅ **Analysis Complete** - See `analysis.md` for full details
2. ⏳ **Awaiting Review** - Stakeholder review of clarifications 1-2
3. 🔜 **Update Spec** - Incorporate approved clarifications
4. 🔜 **Create Plan** - Proceed to `plan.md` with architecture diagram

---

## References

- Full Analysis: [analysis.md](./analysis.md)
- Specification: [spec.md](./spec.md)
- ADR 003: [Server-Sent Events](../../docs/adr/003-server-sent-events.md)
- PRD: [Real-Time Stream](../../docs/PRD.md#7-data-flow)
