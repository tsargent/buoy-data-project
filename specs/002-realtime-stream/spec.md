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
- **FR-009**: System MUST deliver observation events to clients within 200ms of the worker processing the observation
- **FR-010**: The streaming endpoint MUST be compatible with the browser's native EventSource API and standard SSE clients
- **FR-011**: System MUST respond with HTTP 500 and close the connection if Redis or database initialization fails during stream setup
- **FR-012**: System MUST respond with HTTP 400 if the client request is missing required SSE headers or is otherwise malformed

### Key Entities

- **Observation Event**: A real-time message sent to connected clients containing buoy observation data with fields matching the database schema (stationId, timestamp, waveHeightM, windSpeedMps, windDirDeg, waterTempC, pressureHpa)
- **Stream Connection**: An active SSE connection between a client and the server, maintained as a long-lived HTTP request with keep-alive semantics
- **Redis Pub/Sub Channel**: The `observations:new` Redis channel used to broadcast observation events from the worker process to the server process, enabling decoupled real-time communication

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Browser clients can establish a streaming connection and receive a confirmation event within 100ms of connecting
- **SC-002**: Observation events are delivered to all connected clients within 200ms of being processed by the worker
- **SC-003**: The system maintains stable connections with at least 10 concurrent clients without data loss
- **SC-004**: Connection cleanup occurs within 5 seconds of client disconnection, preventing resource leaks
- **SC-005**: The streaming endpoint responds with proper HTTP status codes (200 for successful connection, appropriate error codes for failures)
- **SC-006**: Audio/visual clients can successfully parse and utilize observation events for real-time sonification and visualization
