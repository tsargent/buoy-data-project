# Manual Testing Guide for Spec 002: Real-Time SSE Streaming

This guide will walk you through testing the real-time buoy observation streaming via Server-Sent Events (SSE).

## Prerequisites

Before testing, ensure you have:

1. ✅ PostgreSQL database running
2. ✅ Redis server running
3. ✅ At least one station in the database (e.g., station 44009)

## Quick Setup

### 1. Start Redis (if not running)

```bash
# Check if Redis is running
redis-cli ping

# If not running, start Redis
redis-server

# Or with Homebrew on macOS
brew services start redis
```

### 2. Start the Server

```bash
# Terminal 1: Start the API server
cd apps/server
pnpm run dev

# You should see:
# - "Redis subscriber initialized"
# - "API on :3000"
```

### 3. Start the Worker (Optional - for live data)

```bash
# Terminal 2: Start the worker for live observations
cd apps/worker
pnpm run dev

# The worker will fetch data every 10 minutes
```

### 4. Open the Test Client

```bash
# Open the test HTML client in your browser
open test-sse-client.html

# Or manually navigate to:
# file:///path/to/buoy-sonification/test-sse-client.html
```

---

## Test Scenarios

### ✅ Test 1: Connection Event (SC-001)

**Success Criteria:** Connection event received within 100ms

**Steps:**
1. Open `test-sse-client.html` in your browser
2. Open Browser DevTools (F12) → Network tab
3. Filter by "EventSource" or "stream"
4. Click **"Connect"** button
5. Watch the Network tab for the SSE connection

**Expected Results:**
- ✅ Status changes to "Connected" (green)
- ✅ Connection Events counter shows "1"
- ✅ Event stream shows connection event with timestamp
- ✅ Network tab shows status "200 OK" with type "eventsource"
- ✅ Connection event appears within ~100ms

**Verification:**
```json
Event: connection
Data: {
  "status": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ✅ Test 2: Observation Event (SC-002)

**Success Criteria:** Observation events delivered within 200ms of database insert

**Option A: Trigger via Redis CLI (fastest)**

```bash
# In a new terminal, publish a test observation
redis-cli PUBLISH observations:new '{
  "stationId": "44009",
  "timestamp": "2024-01-15T10:25:00.000Z",
  "waveHeightM": 2.5,
  "windSpeedMps": 12.3,
  "windDirDeg": 180,
  "waterTempC": 18.5,
  "pressureHpa": 1013.2
}'
```

**Option B: Wait for Worker (requires worker running)**

Wait for the worker to fetch and process data (every 10 minutes). Watch the worker logs:

```
Processing station 44009...
Published 5 new observations to Redis
```

**Expected Results:**
- ✅ Observation event appears in test client immediately
- ✅ Observation Events counter increments
- ✅ Event data matches the published observation
- ✅ All fields are present (stationId, timestamp, measurements)

**Verification:**
```json
Event: observation
Data: {
  "stationId": "44009",
  "timestamp": "2024-01-15T10:25:00.000Z",
  "waveHeightM": 2.5,
  "windSpeedMps": 12.3,
  "windDirDeg": 180,
  "waterTempC": 18.5,
  "pressureHpa": 1013.2
}
```

---

### ✅ Test 3: Multiple Concurrent Clients (SC-003)

**Success Criteria:** 10 concurrent clients receive events without data loss

**Steps:**
1. Open `test-sse-client.html` in 3 different browser tabs (or different browsers)
2. Click "Connect" in each tab
3. Check server logs - you should see:
   ```
   SSE client connected (connectionCount: 1)
   SSE client connected (connectionCount: 2)
   SSE client connected (connectionCount: 3)
   ```
4. Publish a test observation via Redis CLI (see Test 2)
5. Verify ALL 3 tabs receive the same observation event

**Expected Results:**
- ✅ All clients connect successfully
- ✅ Server logs show correct connection count
- ✅ All clients receive the same observation event simultaneously
- ✅ No clients miss events
- ✅ Observation counts match across all tabs

**For 10 clients:** Repeat with 10 browser tabs or use a load testing tool.

---

### ✅ Test 4: Connection Cleanup (SC-004)

**Success Criteria:** Cleanup within 5 seconds of disconnection

**Steps:**
1. Connect a client
2. Note the connection time (check "Connection Duration" stat)
3. Click **"Disconnect"** button (or close the browser tab)
4. Check server logs immediately

**Expected Results:**
- ✅ Status changes to "Disconnected" (red)
- ✅ Server logs show:
   ```json
   {
     "level": "info",
     "msg": "SSE client disconnected",
     "connectionDuration": 15,
     "connectionCount": 0,
     "requestId": "..."
   }
   ```
- ✅ Disconnection logged within 1 second (instant)
- ✅ Connection count decremented
- ✅ No resource leaks (verify with `/metrics` endpoint)

---

### ✅ Test 5: Redis Unavailable (SC-005)

**Success Criteria:** HTTP 503 when Redis is down

**Steps:**
1. Stop Redis:
   ```bash
   redis-cli shutdown
   # Or: brew services stop redis
   ```
2. Try to connect SSE client
3. Check response in Browser DevTools → Network tab

**Expected Results:**
- ✅ Connection fails immediately
- ✅ HTTP status: `503 Service Unavailable`
- ✅ Error response body:
   ```json
   {
     "error": "SERVICE_UNAVAILABLE",
     "message": "Real-time streaming is temporarily unavailable",
     "statusCode": 503
   }
   ```
- ✅ Client shows "Error / Reconnecting..." status
- ✅ Browser automatically retries connection

**Cleanup:**
```bash
# Restart Redis
redis-server
# Or: brew services start redis

# Restart server (it should reconnect automatically)
```

---

### ✅ Test 6: Auto-Reconnection (SC-003)

**Success Criteria:** Client automatically reconnects after server restart

**Steps:**
1. Connect client (should see connection event)
2. Stop the server: `Ctrl+C` in server terminal
3. Wait 3-5 seconds (browser tries to reconnect)
4. Restart server: `pnpm run dev` in apps/server
5. Watch the client

**Expected Results:**
- ✅ Client shows "Error / Reconnecting..." after server stops
- ✅ Browser automatically attempts reconnection (every 3-6 seconds)
- ✅ When server restarts, client reconnects automatically
- ✅ New connection event received
- ✅ Connection Events counter increments
- ✅ Client can receive new observations

---

### ✅ Test 7: EventSource API Compatibility (SC-006)

**Success Criteria:** Standard EventSource API works correctly

**Steps:**
1. Open Browser DevTools → Console
2. Run this JavaScript:
   ```javascript
   const es = new EventSource('http://localhost:3000/v1/observations/stream');
   es.addEventListener('connection', e => console.log('Connected:', e.data));
   es.addEventListener('observation', e => console.log('Observation:', e.data));
   es.onerror = e => console.error('Error:', e);
   ```
3. Watch console output

**Expected Results:**
- ✅ No JavaScript errors
- ✅ Connection event logged to console
- ✅ Observation events logged to console
- ✅ Data is valid JSON that can be parsed
- ✅ No CORS errors (in development mode)

---

## Monitoring & Metrics

### Check Prometheus Metrics

```bash
# View all metrics
curl http://localhost:3000/metrics

# Filter SSE metrics
curl http://localhost:3000/metrics | grep sse_

# Expected metrics:
# sse_connections_total 2
# sse_events_sent_total{event_type="connection"} 2
# sse_events_sent_total{event_type="observation"} 5
# sse_connection_duration_seconds_bucket{le="1"} 0
# sse_broadcast_latency_ms_bucket{le="10"} 5
```

### Check Structured Logs

Server logs should show structured JSON:

```json
{
  "level": "info",
  "time": 1234567890,
  "event": "sse_client_connected",
  "connectionCount": 1,
  "requestId": "abc-123",
  "msg": "SSE client connected"
}
```

Worker logs (after publishing):

```json
{
  "level": "debug",
  "time": 1234567890,
  "event": "observation_published",
  "channel": "observations:new",
  "stationId": "44009",
  "attempt": 1,
  "msg": "Published observation to Redis"
}
```

---

## Testing with cURL

For quick command-line testing:

```bash
# Connect to SSE stream
curl -N http://localhost:3000/v1/observations/stream

# Expected output (streaming):
event: connection
data: {"status":"connected","timestamp":"2024-01-15T10:30:00.000Z"}

event: observation
data: {"stationId":"44009",...}

# Press Ctrl+C to disconnect
```

---

## Load Testing (Advanced)

### Test with Multiple Clients

Create a simple Node.js script:

```javascript
// test-multiple-clients.js
import EventSource from 'eventsource';

const clientCount = 10;
const clients = [];

for (let i = 0; i < clientCount; i++) {
  const es = new EventSource('http://localhost:3000/v1/observations/stream');
  
  es.addEventListener('connection', () => {
    console.log(`Client ${i + 1} connected`);
  });
  
  es.addEventListener('observation', (e) => {
    const data = JSON.parse(e.data);
    console.log(`Client ${i + 1} received: ${data.stationId}`);
  });
  
  clients.push(es);
}

// Cleanup after 60 seconds
setTimeout(() => {
  clients.forEach(es => es.close());
  console.log('All clients disconnected');
  process.exit(0);
}, 60000);
```

Run it:

```bash
# Install eventsource package
npm install eventsource

# Run the test
node test-multiple-clients.js
```

---

## Common Issues & Solutions

### Issue: "Connection refused"
**Solution:** Make sure server is running on port 3000
```bash
cd apps/server && pnpm run dev
```

### Issue: "Service unavailable (503)"
**Solution:** Redis is not running
```bash
redis-server
```

### Issue: No observation events
**Solution:** Either wait for worker to run, or manually publish via Redis CLI:
```bash
redis-cli PUBLISH observations:new '{"stationId":"44009","timestamp":"2024-01-15T10:00:00Z","waveHeightM":2.5,"windSpeedMps":10,"windDirDeg":180,"waterTempC":20,"pressureHpa":1013}'
```

### Issue: CORS errors
**Solution:** Server has CORS enabled in development. If testing from a different origin in production, update CORS config in `apps/server/src/app.ts`

### Issue: Events appearing slowly
**Solution:** Check server logs for latency warnings. Redis should be on localhost for <10ms latency.

---

## Success Checklist

Use this checklist to verify all success criteria:

- [ ] **SC-001**: Connection event received within 100ms ✓
- [ ] **SC-002**: Observation events within 200ms of insert ✓
- [ ] **SC-003**: 10 concurrent clients work without data loss ✓
- [ ] **SC-004**: Cleanup within 5 seconds (actually instant) ✓
- [ ] **SC-005**: HTTP 503 when Redis unavailable ✓
- [ ] **SC-006**: EventSource API compatibility ✓
- [ ] Metrics are being recorded at `/metrics` ✓
- [ ] Structured logs are in JSON format ✓
- [ ] Auto-reconnection works after server restart ✓
- [ ] Multiple browser tabs can connect simultaneously ✓

---

## Next Steps After Testing

Once manual testing passes:

1. Document test results in `specs/002-realtime-stream/test-results.md`
2. Run load tests with 50+ clients (Task 6.2)
3. Test in multiple browsers: Chrome, Firefox, Safari (Task 8.4)
4. Write automated integration tests (Task 8.2)
5. Add unit tests for key components (Task 8.1)

---

## Need Help?

- Check server logs for errors
- Verify Redis is accessible: `redis-cli ping`
- Check database has stations: `psql -d buoy_data -c "SELECT id FROM stations LIMIT 5;"`
- Review API documentation: `docs/API.md`
- Check metrics endpoint: `http://localhost:3000/metrics`
