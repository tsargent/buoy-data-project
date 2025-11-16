# Buoy Sonification API Documentation

This document describes the HTTP API endpoints for accessing buoy observation data.

## Base URL

```
http://localhost:3000
```

All API endpoints are prefixed with `/v1/`.

---

## Endpoints

### GET /v1/observations/stream

**Real-time observation stream using Server-Sent Events (SSE).**

Returns a continuous stream of buoy observations as they are ingested by the system. Uses the Server-Sent Events (SSE) protocol for real-time, unidirectional streaming from server to client.

#### Request

**Method:** `GET`

**Headers:**
- `Accept: text/event-stream` (optional but recommended)

**Parameters:** None

**Example:**
```bash
curl -N -H "Accept: text/event-stream" http://localhost:3000/v1/observations/stream
```

#### Response

**Status Code:** `200 OK`

**Headers:**
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- `X-Accel-Buffering: no` (disables proxy buffering)

**Body:** Continuous stream of Server-Sent Events (SSE)

The server sends two types of events:

##### 1. Connection Event

Sent immediately upon successful connection.

```
event: connection
data: {"status":"connected","timestamp":"2024-01-15T10:30:00.000Z"}
```

**Schema:**
```typescript
{
  status: "connected",
  timestamp: string  // ISO 8601 datetime
}
```

##### 2. Observation Event

Sent whenever a new observation is ingested into the system.

```
event: observation
data: {"stationId":"44009","timestamp":"2024-01-15T10:25:00.000Z","waveHeightM":2.5,"windSpeedMps":12.3,"windDirDeg":180,"waterTempC":18.5,"pressureHpa":1013.2}
```

**Schema:**
```typescript
{
  stationId: string,      // NDBC station identifier (e.g., "44009")
  timestamp: string,      // ISO 8601 datetime of observation
  waveHeightM: number | null,     // Wave height in meters
  windSpeedMps: number | null,    // Wind speed in meters per second
  windDirDeg: number | null,      // Wind direction in degrees (0-360)
  waterTempC: number | null,      // Water temperature in Celsius
  pressureHpa: number | null      // Atmospheric pressure in hectopascals
}
```

**Note:** All measurement fields (`waveHeightM`, `windSpeedMps`, etc.) may be `null` if the sensor data is not available.

#### Error Responses

**503 Service Unavailable**
```json
{
  "error": "SERVICE_UNAVAILABLE",
  "message": "Real-time streaming is temporarily unavailable",
  "statusCode": 503
}
```

Returned when the Redis pub/sub system is not connected.

---

## Usage Examples

### Browser JavaScript

```javascript
const eventSource = new EventSource('http://localhost:3000/v1/observations/stream');

// Handle connection confirmation
eventSource.addEventListener('connection', (event) => {
  const data = JSON.parse(event.data);
  console.log('Connected at:', data.timestamp);
});

// Handle new observations
eventSource.addEventListener('observation', (event) => {
  const observation = JSON.parse(event.data);
  console.log('New observation:', observation);
  
  // Example: Use observation data for sonification
  if (observation.waveHeightM !== null) {
    const frequency = 200 + (observation.waveHeightM * 50);
    playTone(frequency);
  }
});

// Handle errors and reconnection
eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  // Browser automatically reconnects
};

// Close connection when done
// eventSource.close();
```

### Node.js

Install the `eventsource` package:

```bash
npm install eventsource
```

```javascript
import EventSource from 'eventsource';

const eventSource = new EventSource('http://localhost:3000/v1/observations/stream');

eventSource.addEventListener('connection', (event) => {
  const data = JSON.parse(event.data);
  console.log('Connected at:', data.timestamp);
});

eventSource.addEventListener('observation', (event) => {
  const observation = JSON.parse(event.data);
  console.log('New observation:', observation);
  
  // Example: Forward to OSC endpoint
  sendOSC('/observation', [
    observation.stationId,
    observation.waveHeightM,
    observation.windSpeedMps,
    observation.windDirDeg,
  ]);
});

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};

// Graceful shutdown
process.on('SIGINT', () => {
  eventSource.close();
  process.exit(0);
});
```

### cURL (for testing)

```bash
# Stream observations to console
curl -N http://localhost:3000/v1/observations/stream

# Save to file
curl -N http://localhost:3000/v1/observations/stream > observations.log
```

---

## SSE Protocol Details

### Event Format

Server-Sent Events use a simple text-based protocol. Each event consists of:

```
event: <event-type>
data: <json-payload>

```

- Each field ends with a newline (`\n`)
- Events are separated by a blank line (`\n\n`)
- The `event` field specifies the event type
- The `data` field contains the JSON payload

### Connection Lifecycle

1. **Client connects** → Server sends `connection` event
2. **Observations arrive** → Server sends `observation` events as they're ingested
3. **Connection interrupted** → Browser automatically reconnects with exponential backoff
4. **Client closes** → Send explicit close or close browser tab

### Auto-Reconnection

Modern browsers automatically reconnect to SSE endpoints when the connection is lost. The browser includes a `Last-Event-ID` header to help the server resume where it left off.

**Note:** This API uses a **fire-and-forget broadcast model** and does not support resuming from a specific event ID. Clients should expect to receive only new events after reconnection.

---

## Edge Cases and Limitations

### Fire-and-Forget Model

- Events are broadcast to all connected clients in real-time
- No event buffering or replay capability
- Clients that connect after an event is sent will not receive it
- No guaranteed delivery (unlike message queues)

### Slow Clients

- If a client cannot process events fast enough, it may miss events
- Server does not wait for slow clients to catch up
- No backpressure mechanism
- Recommended: Keep client processing lightweight, offload heavy work to background threads

### Reconnection Behavior

- Browsers automatically reconnect with exponential backoff (3s, 6s, 12s, etc.)
- On reconnection, client receives a new `connection` event
- No catch-up mechanism—only new observations are sent after reconnection
- Client is responsible for deduplication if needed

### Deduplication

- Multiple clients may receive the same observation
- Clients should deduplicate by `(stationId, timestamp)` tuple if needed
- Worker uses `UPSERT` logic to prevent duplicate database entries

### Concurrency

- The API supports multiple concurrent SSE connections
- Each connection receives all broadcast events independently
- No per-client filtering or subscription topics (yet)

### Network Considerations

- **Proxies:** Some proxies buffer responses. The `X-Accel-Buffering: no` header hints proxies not to buffer SSE streams.
- **Timeouts:** Long-lived connections may be terminated by intermediate proxies or load balancers. Browsers automatically reconnect.
- **CORS:** CORS is enabled for development. In production, configure allowed origins appropriately.

---

## Architecture

```
Worker (NDBC Ingestion)
  ↓ (inserts observation)
Database (PostgreSQL)
  ↓ (publishes to Redis)
Redis Pub/Sub (observations:new channel)
  ↓ (broadcasts message)
Server (Fastify SSE Endpoint)
  ↓ (sends SSE event)
Clients (Browsers, Node.js, etc.)
```

**Flow:**
1. Worker fetches buoy data from NDBC
2. Worker inserts observation into PostgreSQL
3. Worker publishes observation to Redis `observations:new` channel
4. Server (subscribed to Redis) receives message
5. Server broadcasts to all connected SSE clients
6. Clients receive `observation` event and process data

---

## Related Documentation

- [AUDIO_CLIENTS.md](./AUDIO_CLIENTS.md) - Integration patterns for sonification clients
- [ADR 003: Server-Sent Events](../docs/adr/003-server-sent-events.md) - Architectural decision record
- [Spec 002: Real-Time Streaming](../specs/002-realtime-stream/spec.md) - Feature specification

---

## Health Check

```bash
# Check if server is running
curl http://localhost:3000/health

# Response: 200 OK
{"status":"ok"}
```

## Metrics

Prometheus metrics are exposed at `/metrics`:

```bash
curl http://localhost:3000/metrics
```

SSE-specific metrics include:
- `sse_connections_total` (gauge) - Current number of active SSE connections
- `sse_events_sent_total` (counter) - Total events sent, labeled by event type
- `sse_connection_duration_seconds` (histogram) - Connection duration distribution
- `sse_broadcast_latency_ms` (histogram) - Broadcast latency distribution
