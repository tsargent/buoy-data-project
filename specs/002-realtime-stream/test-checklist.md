# Testing Checklist: Real-Time Buoy Data Streaming

**Feature**: 002-realtime-stream  
**Date**: 2024-11-16  
**Status**: In Progress

## Quick Reference Test Commands

### Start Services
```bash
# Start Docker services (PostgreSQL + Redis)
docker compose up -d

# Start server
cd apps/server && pnpm dev

# Start worker
cd apps/worker && pnpm dev

# Serve test client
python3 -m http.server 8080
```

### Manual Testing Tools
```bash
# Open test client
open http://localhost:8080/test-sse-client.html

# Manual Redis publish (test observation)
redis-cli PUBLISH observations:new '{
  "stationId": "46050",
  "timestamp": "2024-11-16T20:00:00.000Z",
  "waveHeightM": 3.5,
  "windSpeedMps": 15.0,
  "windDirDeg": 270,
  "waterTempC": 19.0,
  "pressureHpa": 1012.0
}'

# Check Redis connection
redis-cli PING

# Monitor Redis pub/sub
redis-cli MONITOR

# Check database
pnpm --filter server prisma:studio
```

---

## Priority 1: Complete P0 Testing (Task 8.3)

### Test SC-004: Connection Cleanup Within 5 Seconds

- [ ] **Setup**: Start server with debug logging
- [ ] **Action**: 
  - Connect test client (note exact timestamp)
  - Close browser tab immediately
  - Watch server logs for cleanup event
- [ ] **Verify**:
  - `sse_client_disconnected` log appears
  - Time delta < 5 seconds
  - Connection count decremented
  - No errors in logs
- [ ] **Document**: Record actual cleanup time in test-results.md

**Commands**:
```bash
# Server should show structured logs
# Look for: {"event":"sse_client_disconnected","connectionDuration":...}
```

---

### Test SC-005: HTTP Status Codes

#### Test HTTP 500 (Redis Unavailable)

- [ ] **Setup**: Start server, stop Redis
- [ ] **Action**: Try to connect EventSource
- [ ] **Verify**:
  - HTTP 500 status code
  - Error message: "SERVICE_UNAVAILABLE"
  - Connection closes immediately
  - No server crash
- [ ] **Document**: Capture error response in test-results.md

**Commands**:
```bash
# Stop Redis
docker compose stop redis

# Try to connect (should fail)
curl -v http://localhost:3000/v1/observations/stream

# Or use browser DevTools Network tab

# Restart Redis
docker compose start redis
```

#### Test HTTP 400 (Invalid Request)

- [ ] **Setup**: Server running normally
- [ ] **Action**: Send request with invalid Accept header
- [ ] **Verify**:
  - HTTP 400 status code (if validation implemented)
  - Error message: "INVALID_REQUEST"
  - Connection closes immediately
- [ ] **Document**: Capture behavior in test-results.md

**Commands**:
```bash
# Test with explicit wrong Accept header
curl -v -H "Accept: application/json" http://localhost:3000/v1/observations/stream

# Expected: May return 400 or fall back to SSE (depends on implementation)
```

---

### Test US1 Scenario 3: Multiple Observations in Chronological Order

- [ ] **Setup**: 
  - Start server and test client
  - Prepare 5 test observations with sequential timestamps
- [ ] **Action**: 
  - Publish 5 observations via Redis CLI rapidly
  - Record order received in browser
- [ ] **Verify**:
  - All 5 observations received
  - Order matches sent order
  - Timestamps are chronological
- [ ] **Document**: Record test observations and results

**Test Data**:
```bash
# Observation 1 (10:00:00)
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T10:00:00.000Z","waveHeightM":2.0,"windSpeedMps":10.0,"windDirDeg":180,"waterTempC":18.0,"pressureHpa":1013.0}'

# Observation 2 (10:01:00)
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T10:01:00.000Z","waveHeightM":2.2,"windSpeedMps":11.0,"windDirDeg":185,"waterTempC":18.1,"pressureHpa":1013.5}'

# Observation 3 (10:02:00)
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T10:02:00.000Z","waveHeightM":2.5,"windSpeedMps":12.0,"windDirDeg":190,"waterTempC":18.2,"pressureHpa":1014.0}'

# Observation 4 (10:03:00)
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T10:03:00.000Z","waveHeightM":2.8,"windSpeedMps":13.0,"windDirDeg":195,"waterTempC":18.3,"pressureHpa":1014.5}'

# Observation 5 (10:04:00)
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T10:04:00.000Z","waveHeightM":3.0,"windSpeedMps":14.0,"windDirDeg":200,"waterTempC":18.4,"pressureHpa":1015.0}'
```

---

### Test US2 Scenario 2: One Client Disconnects, Others Continue

- [ ] **Setup**: 
  - Open 3 browser tabs with test client
  - Verify all connected (connection count = 3)
- [ ] **Action**: 
  - Close tab 1
  - Publish test observation via Redis CLI
  - Check tabs 2 and 3
- [ ] **Verify**:
  - Tabs 2 and 3 still receive events
  - No errors in server logs
  - Connection count = 2
  - No disruption to remaining clients
- [ ] **Document**: Record results

**Commands**:
```bash
# After closing one tab, publish test event
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T11:00:00.000Z","waveHeightM":3.5,"windSpeedMps":15.0,"windDirDeg":270,"waterTempC":19.0,"pressureHpa":1012.0}'

# Check server logs for:
# - sse_client_disconnected (for closed tab)
# - Connection count updated
# - No errors
```

---

### Test US3 Scenario 1: Client Disconnect Triggers Cleanup

- [ ] **Setup**: 
  - Connect test client
  - Open server logs
  - Note connection count
- [ ] **Action**: 
  - Close browser tab
  - Monitor server logs
- [ ] **Verify**:
  - `sse_client_disconnected` log appears
  - `connectionDuration` field present
  - Connection count decrements
  - Cleanup occurs within 5 seconds
  - No errors or warnings
- [ ] **Repeat**: Run test 10 times to verify consistency
- [ ] **Document**: Record cleanup times (min, max, avg)

---

### Test US3 Scenario 2: Network Loss Triggers Auto-Reconnect

- [ ] **Setup**: 
  - Connect test client
  - Open browser DevTools console
- [ ] **Action**: 
  - Stop server (simulates network loss)
  - Wait 5 seconds
  - Start server
  - Observe browser behavior
- [ ] **Verify**:
  - Browser shows "Connection lost" or similar
  - Browser automatically attempts reconnect
  - Connection re-established within ~3 seconds
  - New connection event received
  - Events resume after reconnect
- [ ] **Document**: 
  - Note EventSource auto-reconnect behavior
  - Record reconnection time

**Commands**:
```bash
# Stop server (in server terminal)
Ctrl+C

# Wait 5 seconds, then restart
cd apps/server && pnpm dev

# Observe browser console for reconnection
```

---

### Test US3 Scenario 3: Reconnect Only Receives New Events

- [ ] **Setup**: 
  - Connect test client
  - Note last observation timestamp
- [ ] **Action**: 
  - Close browser tab (disconnect)
  - Publish 3 test observations via Redis CLI (will be "missed")
  - Wait 10 seconds
  - Reconnect test client (open new tab)
  - Publish 1 new observation
- [ ] **Verify**:
  - Reconnected client does NOT receive the 3 missed observations
  - Reconnected client DOES receive the new observation
  - Connection event received on reconnect
  - No historical playback occurs
- [ ] **Document**: Confirm no catch-up behavior

**Test Sequence**:
```bash
# 1. Client connected, then close tab

# 2. Publish 3 "missed" observations
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T12:00:00.000Z","waveHeightM":1.0,"windSpeedMps":5.0,"windDirDeg":90,"waterTempC":17.0,"pressureHpa":1010.0}'
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T12:01:00.000Z","waveHeightM":1.2,"windSpeedMps":6.0,"windDirDeg":95,"waterTempC":17.1,"pressureHpa":1010.5}'
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T12:02:00.000Z","waveHeightM":1.5,"windSpeedMps":7.0,"windDirDeg":100,"waterTempC":17.2,"pressureHpa":1011.0}'

# 3. Wait 10 seconds

# 4. Reconnect client (open new browser tab)

# 5. Publish new observation
redis-cli PUBLISH observations:new '{"stationId":"46050","timestamp":"2024-11-16T12:10:00.000Z","waveHeightM":4.0,"windSpeedMps":20.0,"windDirDeg":270,"waterTempC":19.5,"pressureHpa":1009.0}'

# 6. Verify client only shows the 12:10:00 observation, not 12:00-12:02
```

---

## Priority 2: Browser Compatibility Testing (Task 8.4)

### Firefox

- [ ] **Install/Update**: Ensure latest Firefox installed
- [ ] **Test**: Open test client in Firefox
- [ ] **Verify**:
  - EventSource connection works
  - Connection event received
  - Observation events received
  - DevTools shows SSE connection
  - Auto-reconnect works
- [ ] **Document**: Firefox version and results

### Safari

- [ ] **Test**: Open test client in Safari
- [ ] **Verify**:
  - EventSource connection works
  - Connection event received
  - Observation events received
  - Web Inspector shows SSE connection
  - Auto-reconnect works
- [ ] **Document**: Safari version and results

### Edge (if available)

- [ ] **Test**: Open test client in Edge
- [ ] **Verify**:
  - EventSource connection works
  - Connection event received
  - Observation events received
  - DevTools shows SSE connection
  - Auto-reconnect works
- [ ] **Document**: Edge version and results

---

## Priority 3: Edge Cases Testing

### No Active Stations

- [ ] **Setup**: 
  - Connect to database: `psql` or Prisma Studio
  - Update all stations: `UPDATE "Station" SET "isActive" = false;`
- [ ] **Action**: 
  - Start server
  - Connect test client
  - Trigger worker job
- [ ] **Verify**:
  - Connection established successfully
  - No observation events sent
  - No errors or crashes
  - Server logs show no stations active
- [ ] **Cleanup**: Re-enable stations
- [ ] **Document**: Results

---

### Database Query Failure

- [ ] **Setup**: Start server
- [ ] **Action**: 
  - Stop PostgreSQL: `docker compose stop postgres`
  - Try to connect SSE client
- [ ] **Verify**:
  - HTTP 500 (or connection succeeds if DB not checked at init)
  - Appropriate error message
  - No server crash
  - Graceful handling
- [ ] **Cleanup**: Restart PostgreSQL
- [ ] **Document**: Results

---

### High Volume Publishing

- [ ] **Setup**: 
  - Create script to publish 100 observations rapidly
  - Start server and client
- [ ] **Action**: 
  - Run publish script
  - Monitor client
  - Monitor server logs
- [ ] **Verify**:
  - All (or most) events delivered
  - No server crash
  - Measure delivery rate
  - Note any dropped events
- [ ] **Document**: 
  - Number sent vs received
  - Performance characteristics

**Test Script** (create `test-high-volume.sh`):
```bash
#!/bin/bash
for i in {1..100}; do
  redis-cli PUBLISH observations:new "{\"stationId\":\"46050\",\"timestamp\":\"2024-11-16T$(printf "%02d" $((i/60))):$(printf "%02d" $((i%60))):00.000Z\",\"waveHeightM\":$((i % 10 + 1)).0,\"windSpeedMps\":$((i % 20 + 5)).0,\"windDirDeg\":$((i % 360)),\"waterTempC\":18.0,\"pressureHpa\":1013.0}" &
done
wait
```

---

## Priority 4: Load Testing (Task 6.2)

### Concurrent Connections Test

- [ ] **Setup**: Install load testing tool
  ```bash
  npm install -g eventsource artillery
  ```
- [ ] **Create**: Load test script (see below)
- [ ] **Action**: Run with increasing client counts (10, 25, 50, 75, 100)
- [ ] **Monitor**:
  - Server CPU usage
  - Server memory usage
  - Connection count metrics
  - Event delivery latency
- [ ] **Verify**:
  - Server handles 50+ clients
  - Latency < 200ms
  - Memory stable (no leaks)
  - CPU < 80%
- [ ] **Document**: Performance results

**Load Test Script** (`load-test.js`):
```javascript
const EventSource = require('eventsource');

async function testClients(count) {
  const clients = [];
  const startTime = Date.now();
  
  console.log(`Creating ${count} clients...`);
  
  for (let i = 0; i < count; i++) {
    const es = new EventSource('http://localhost:3000/v1/observations/stream');
    
    es.on('connection', (event) => {
      const data = JSON.parse(event.data);
      console.log(`Client ${i}: Connected at ${data.timestamp}`);
    });
    
    es.on('observation', (event) => {
      const data = JSON.parse(event.data);
      const latency = Date.now() - startTime;
      console.log(`Client ${i}: Observation received (${latency}ms latency)`);
    });
    
    es.on('error', (error) => {
      console.error(`Client ${i}: Error`, error);
    });
    
    clients.push(es);
  }
  
  console.log(`${count} clients connected`);
  
  // Keep running for 60 seconds
  setTimeout(() => {
    console.log('Closing all clients...');
    clients.forEach(es => es.close());
    process.exit(0);
  }, 60000);
}

const clientCount = parseInt(process.argv[2]) || 50;
testClients(clientCount);
```

**Usage**:
```bash
node load-test.js 10   # 10 clients
node load-test.js 50   # 50 clients
node load-test.js 100  # 100 clients
```

---

## Documentation Tasks

### Task 9.2: Implementation Notes

- [ ] Create `docs/SSE_IMPLEMENTATION.md`
- [ ] Document architecture diagram
- [ ] Explain Worker → Redis → Server → Client flow
- [ ] Document connection lifecycle
- [ ] Explain design decisions (fire-and-forget, no buffering)
- [ ] Document known limitations
- [ ] Document monitoring approach
- [ ] Include code examples

### Task 9.3: Create ADR 004

- [ ] Create `docs/adr/004-redis-pubsub.md`
- [ ] Document context (need for Worker → Server communication)
- [ ] Document decision (Redis Pub/Sub)
- [ ] List alternatives considered:
  - Database polling
  - HTTP webhooks
  - Shared EventEmitter
  - Message queues (RabbitMQ, Kafka)
- [ ] Document consequences:
  - Pros: Simple, fast, decoupled, horizontally scalable
  - Cons: Adds Redis dependency, fire-and-forget (no persistence)
- [ ] Reference existing ADR format (see 001-003 for template)

---

## Final Checklist

### Before Marking Complete

- [ ] All P0 tests completed and documented in test-results.md
- [ ] All success criteria verified
- [ ] All user story scenarios tested
- [ ] Critical edge cases tested
- [ ] At least 3 browsers tested
- [ ] Load testing with 50+ clients completed
- [ ] All issues documented and resolved
- [ ] Implementation notes created
- [ ] ADR 004 created
- [ ] Test results reviewed and signed off

### Sign-off

- [ ] All tests passed
- [ ] No critical issues outstanding
- [ ] Documentation complete
- [ ] Ready for production deployment

**Completed By**: _________________  
**Date**: _________________  
**Reviewed By**: _________________  
**Date**: _________________
