# Feature Specification: Real-Time Buoy Data Streaming

**Feature Branch**: `002-realtime-stream`  
**Created**: 2025-11-15  
**Updated**: 2025-11-15  
**Status**: Clarified  
**Input**: User description: "Stream the buoy data to the browser in realtime. Read the PRD for more context"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browser Client Receives Live Observations (Priority: P1)

A web browser client connects to the streaming endpoint and receives new buoy observations as they are processed by the worker, enabling real-time visualization and sonification.

**Why this priority**: This is the core MVP functionality - delivering real-time observation data to browser clients is the primary value proposition and enables audio/visual clients to react to live ocean conditions.

**Independent Test**: Can be fully tested by opening a browser, navigating to the stream endpoint, and verifying that new observation events appear in the browser console/UI as the worker processes data. Delivers immediate value by demonstrating real-time data flow.

**Acceptance Scenarios**:

1. **Given** the server is running and has processed observations in the database, **When** a browser client connects to `/v1/observations/stream`, **Then** the client receives a connection event confirming the stream is active
2. **Given** a client is connected to the stream, **When** the worker processes a new observation, **Then** the client receives an observation event within 200ms containing all required fields (stationId, timestamp, waveHeightM, windSpeedMps, windDirDeg, waterTempC, pressureHpa)
3. **Given** multiple observations are processed in quick succession, **When** the worker emits events, **Then** all observations are received by the client in the correct chronological order

---

### User Story 2 - Multiple Concurrent Clients (Priority: P2)

Multiple browser clients can simultaneously connect to the stream endpoint and each independently receive all observation events without interference.

**Why this priority**: Enables multiple users or audio clients to consume the same data stream simultaneously, which is essential for demonstrations, testing, and multi-user scenarios.

**Independent Test**: Can be tested by opening multiple browser tabs/windows, connecting each to the stream, and verifying that all clients receive identical observation events. This can be deployed independently from other features.

**Acceptance Scenarios**:

1. **Given** the server is running, **When** three browser clients connect to `/v1/observations/stream`, **Then** all three clients receive connection events and subsequent observation events
2. **Given** multiple clients are connected, **When** one client disconnects, **Then** the remaining clients continue to receive observation events without interruption

---

### User Story 3 - Graceful Connection Handling (Priority: P3)

Clients automatically reconnect when the connection is interrupted, and the server properly cleans up resources when clients disconnect.

**Why this priority**: Improves reliability and user experience but is not critical for initial MVP. The browser's EventSource API handles reconnection automatically, so this mainly covers server-side cleanup.

**Independent Test**: Can be tested by starting a client connection, restarting the server, and observing that the client automatically reconnects. Can be deployed after the basic streaming is working.

**Acceptance Scenarios**:

1. **Given** a client is connected to the stream, **When** the client closes the browser tab, **Then** the server detects the disconnection and cleans up associated resources
2. **Given** a client connection is established, **When** network connectivity is temporarily lost, **Then** the browser automatically attempts to reconnect once connectivity is restored
3. **Given** a client reconnects after disconnection, **When** new observations are processed, **Then** the client receives new observation events only (no catch-up of missed events; clients needing historical data should query the REST API at `/v1/observations/by-station/:stationId`)

---

### Edge Cases

- What happens when the worker is not running and no new observations are being generated? The stream remains open but no observation events are sent until the worker processes new data.
- How does the system handle a client that connects when there are no active stations? The connection is established successfully, but no observation events are sent until observations are available.
- What happens when database queries fail during stream initialization? The stream connection responds with HTTP 500 and closes gracefully.
- What happens when Redis connection fails during stream initialization? The stream connection responds with HTTP 500 and closes gracefully.
- How does the server handle memory usage with long-lived connections? The server uses a simple broadcast mechanism without buffering historical data, so memory usage remains constant regardless of connection duration.
- What happens when the worker processes observations faster than a client can receive them? The system uses a fire-and-forget broadcast model; clients on slow connections may miss events if their TCP receive buffer fills. Clients should monitor observation timestamps for gaps and query the REST API to fill missing data.
- What happens if the worker processes the same observation multiple times (e.g., due to retries)? The server may send duplicate observation events to clients. Clients can deduplicate using stationId + timestamp as a composite key if necessary.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST expose a streaming endpoint at `/v1/observations/stream` that accepts HTTP GET requests and responds with Server-Sent Events
- **FR-002**: System MUST send a connection event immediately upon client connection to confirm the stream is active. The connection event MUST use event type `connection` and include JSON data with fields: `status` ("connected") and `timestamp` (ISO 8601)
- **FR-003**: System MUST use Redis Pub/Sub to broadcast new observation events from worker to server. Worker MUST publish to the `observations:new` Redis channel after successfully storing an observation. Server MUST subscribe to this channel and broadcast received messages to all connected SSE clients
- **FR-004**: Each observation event MUST include all critical fields: stationId, timestamp (ISO 8601), waveHeightM, windSpeedMps, windDirDeg, waterTempC, and pressureHpa
- **FR-005**: System MUST use the SSE format with `event:` and `data:` fields, where the event type is "observation" for data events and "connection" for connection confirmation
- **FR-006**: System MUST set appropriate HTTP headers for SSE: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `Connection: keep-alive`
- **FR-007**: System MUST detect client disconnections and clean up associated resources to prevent memory leaks
- **FR-008**: System MUST support multiple concurrent client connections without data loss or duplication
- **FR-009**: System MUST achieve p95 end-to-end latency ≤ 200ms measured from Redis publish timestamp to client receipt of the `observation` event. Broadcast loop latency (Redis subscriber receipt → completion of final client write) p95 MUST be ≤ 120ms. Both latencies MUST be recorded and exposed via metrics (see **NFR-Latency**).
- **FR-010**: The streaming endpoint MUST be compatible with the browser's native EventSource API and standard SSE clients
- **FR-011**: System MUST respond with HTTP 500 and close the connection if Redis or database initialization fails during stream setup. Error responses MUST use the standard error shape (see **NFR-Error-Shape**).
- **FR-012**: System MUST respond with HTTP 400 if the client request is malformed. A request is malformed if the method is not GET, or the `Accept` header explicitly excludes `text/event-stream` (e.g. quality factor q=0). Valid `Accept` includes `text/event-stream` or `*/*`. Non-GET MUST return 405. All error responses MUST use the standard error shape (see **NFR-Error-Shape**).

### Non-Functional Requirements

**NFR-Latency**: Two latencies MUST be measured with explicit instrumentation and tiered targets:

 1. End-to-end latency (worker publish → client receipt). Worker MUST include a `publishedAt` ISO 8601 timestamp in each Redis payload prior to `publish`. Client harness records `receivedAt` when the EventSource handler fires. End-to-end latency = `receivedAt - publishedAt`. Target: p95 ≤ 200ms; p50 ≤ 120ms for all tested client counts.
 2. Broadcast loop latency (Redis subscriber handler start → final successful client write). Baseline (≤10 clients): p95 ≤ 120ms; p50 ≤ 80ms. Scaling scenario (≥50 clients): temporary allowance p95 ≤ 150ms (optimization goal to restore ≤120ms); p50 ≤ 100ms.

 Metrics: `sse_broadcast_latency_ms` (loop latency histogram) and an end-to-end latency JSON artifact appended to `specs/002-realtime-stream/test-results.md` capturing `{publishedAt, receivedAt, endToEndMs, loopMs, clientCount}` samples.
 Instrumentation points: (a) Worker sets `publishedAt`; (b) Server marks subscriber handler start timestamp; (c) Server records loop completion timestamp after final write; (d) Client harness captures `receivedAt`.
**Latency Harmonization**: These tiered targets unify FR-009 and NFR-Concurrency; any exceedance of scaling allowance MUST trigger optimization or ADR.
**NFR-Concurrency**: Stable operation validated with ≥10 and ≥50 concurrent clients.
	- Data loss definition: For a controlled sequence of N published observations (N ≥ 100), each client MUST receive all N (EventsReceived == EventsPublished). Any missing sequential observation timestamp constitutes data loss; threshold is zero.
	- 10 clients: Broadcast loop p95 ≤ 120ms; end-to-end p95 ≤ 200ms; RSS growth ≤ 10MB over 60 minutes (idle + sporadic events).
 
- 50 clients: End-to-end p95 ≤ 200ms; broadcast loop p95 ≤ 150ms (initial allowance); RSS growth ≤ 10MB/hour; 0 data loss; CPU p95 < 70%.
- Measurement: Harness logs publish sequence number and per-client receipt counts; memory sampled every 5 minutes.
**NFR-Memory-Stability**: RSS growth ≤ 10MB over 60 minutes with 10 idle clients; ≤ 10MB/hour with 50 active clients; connection objects reclaimed within 5s of disconnect (disconnect log timestamp to removal timestamp < 5000ms).
**NFR-Observability**: Metrics (`sse_connections_total`, `sse_events_sent_total`, `sse_connection_duration_seconds`, `sse_broadcast_latency_ms`, `sse_reconnect_latency_seconds`, `sse_broadcast_errors_total`) and structured logs (connection, disconnection, broadcast, error, reconnect) defined pre-implementation and exposed at `/metrics`.
  - `sse_broadcast_errors_total` (Counter, labels: `reason` = `json_parse` | `schema_invalid` | `write_failed`): increments once per failed broadcast attempt cause.
  - All metrics MUST be declared before implementing Tasks 3.2/4.2 (Constitution 2.3) and verified in Task 7.1 (refined role: validation only).
**NFR-Error-Shape**: Streaming errors use `{ "error": { "code": string, "message": string } }` with enumerated codes: `INVALID_REQUEST`, `SERVICE_UNAVAILABLE`, `METHOD_NOT_ALLOWED`, `INTERNAL_ERROR`. All streaming-related 4xx/5xx statuses MUST use one of these codes.
**NFR-Reconnection**: Auto-reconnect p95 latency (disconnect → receipt of next `connection` event) ≤ 5s measured over ≥20 forced disconnect cycles; no historical replay; metric `sse_reconnect_latency_seconds` histogram captured.
**NFR-Types**: `ConnectionEvent`, `ObservationEvent`, and `ErrorResponse` exported from `packages/shared`; Zod schemas MUST remain key-parity with TypeScript interfaces verified by automated parity tests. All validation of observation events (publisher & subscriber) MUST use the shared `ObservationEventSchema`—no locally duplicated schemas are permitted; parity test (Task 0.7) enforces alignment.
**NFR-Test-First**: Failing smoke test (stream connect + observation) MUST exist (red) before implementing broadcast/publish logic; CI enforces ordering. Evidence MUST include at least one CI run ID (e.g. GitHub Actions run URL) showing the failing smoke test prior to merging Tasks 2.2 and 3.2, and a subsequent passing run after implementation (Red → Green). Commit messages for Tasks 2.2 and 3.2 MUST reference the initial failing run ID to satisfy Constitution 2.2.

### Key Entities

- **Observation Event**: A real-time message sent to connected clients containing buoy observation data with fields matching the database schema (stationId, timestamp, waveHeightM, windSpeedMps, windDirDeg, waterTempC, pressureHpa)
- **Stream Connection**: An active SSE connection between a client and the server, maintained as a long-lived HTTP request with keep-alive semantics
- **Redis Pub/Sub Channel**: The `observations:new` Redis channel used to broadcast observation events from the worker process to the server process, enabling decoupled real-time communication

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Browser clients can establish a streaming connection and receive a confirmation event within 100ms of connecting
- **SC-002**: End-to-end p95 latency ≤ 200ms (publish → client receipt) and broadcast loop p95 ≤ 120ms (subscriber receipt → final write) across ≥100 events; both histograms recorded.
- **SC-003**: 10 concurrent clients receive 100/100 test observations (0 data loss) with broadcast loop p95 ≤ 120ms and RSS growth ≤ 10MB over 60 minutes.
- **SC-004**: Connection cleanup duration (disconnect event log → removal) < 5000ms p95 across ≥50 disconnect cycles; no residual references.
- **SC-005**: Status codes: 200 (success), 400 (invalid/malformed), 405 (non-GET), 500 (infrastructure). Errors use `{ "error": { "code", "message" } }`.
- **SC-006**: Audio/visual clients can successfully parse and utilize observation events for real-time sonification and visualization
