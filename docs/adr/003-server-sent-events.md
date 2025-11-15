# ADR 003: Use Server-Sent Events (SSE) for Real-Time Data Streaming

**Status**: Accepted  
**Date**: 2025-11-14  
**Deciders**: Tyler Sargent  
**Technical Story**: Real-time observation streaming for audio clients

## Context and Problem Statement

The buoy sonification project needs to push real-time observation updates to audio clients (web browsers, Max/MSP, SuperCollider, etc.). Clients should receive new observations as they arrive without polling. The solution must be simple, widely supported, and aligned with the project's HTTP-first architecture.

## Decision Drivers

- **Simplicity**: Easy to implement and consume
- **Browser compatibility**: Works with standard Web APIs
- **HTTP-based**: No additional protocol layer (WebSocket)
- **Firewall-friendly**: Uses standard HTTP/HTTPS ports
- **Constitution Alignment**: Supports "Simplicity & Decomposition" (2.4)
- **Backwards compatibility**: Clients can fall back to polling

## Considered Options

1. **Server-Sent Events (SSE)** - HTTP-based unidirectional push
2. **WebSockets** - Bidirectional persistent connection
3. **Long Polling** - HTTP long-lived requests

## Decision Outcome

**Chosen option**: Server-Sent Events (SSE)

### Positive Consequences

- **Simple protocol**: Built on HTTP, automatic reconnection
- **Native browser support**: `EventSource` API in all modern browsers
- **Unidirectional**: Perfect for data push (observations flow one way)
- **Connection management**: Browser handles reconnection automatically
- **Firewall-friendly**: Standard HTTP/HTTPS, no special ports
- **Lightweight**: Less overhead than WebSocket handshake
- **Streaming-native**: Natural fit for continuous observation stream

### Negative Consequences

- **Browser connection limits**: Browsers limit SSE connections per domain (~6)
- **Unidirectional only**: Cannot send data from client to server over same connection
- **No binary data**: Text-only (JSON payloads work fine for our use case)
- **HTTP/1.1 caveat**: Multiplexing limited (HTTP/2 improves this)

## Pros and Cons of Other Options

### WebSockets

- ✅ Bidirectional communication
- ✅ Binary data support
- ✅ Lower latency for high-frequency updates
- ❌ More complex protocol (handshake, framing)
- ❌ Requires additional server infrastructure
- ❌ Manual reconnection logic needed
- ❌ Overkill for unidirectional push

### Long Polling

- ✅ Universal compatibility
- ✅ Works behind restrictive proxies
- ❌ Higher server load (frequent reconnects)
- ❌ Higher latency (request/response cycle)
- ❌ Manual reconnection logic needed

## Implementation Notes

### Server Implementation (Fastify)

```typescript
// apps/server/src/routes/observations.ts
app.get("/v1/observations/stream", async (req, reply) => {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendEvent = (data: any) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial connection event
  sendEvent({ type: "connected", timestamp: new Date().toISOString() });

  // Subscribe to new observations (future: event emitter or Redis pub/sub)
  const interval = setInterval(async () => {
    const recent = await prisma.observation.findMany({
      where: { observedAt: { gt: new Date(Date.now() - 60000) } },
      take: 10,
    });
    sendEvent({ type: "observations", data: recent });
  }, 15000);

  req.raw.on("close", () => {
    clearInterval(interval);
  });
});
```

### Client Implementation (Browser)

```javascript
// Web client
const eventSource = new EventSource("/v1/observations/stream");

eventSource.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "observations") {
    synthesizeAudio(message.data); // Sonification logic
  }
};

eventSource.onerror = () => {
  console.error("SSE connection lost, will auto-reconnect");
};
```

### Client Implementation (Max/MSP, SuperCollider)

For non-browser clients, use HTTP library with SSE support:

- **Max/MSP**: Use `[jweb]` object or Node.js external
- **SuperCollider**: Use `EventSource` via external process or HTTP polling fallback
- **TouchDesigner**: Use Web Client DAT with streaming mode

## Future Considerations

### Scaling

For high-scale deployments, consider:

1. **Redis Pub/Sub**: Broadcast observations to multiple server instances
2. **Dedicated SSE server**: Separate service for streaming (e.g., Mercure)
3. **HTTP/2**: Enable multiplexing for more concurrent connections

### Binary Data

If sonification requires high-frequency binary audio streams:

- Re-evaluate WebSockets
- Consider WebRTC for low-latency audio
- Hybrid approach: SSE for metadata, separate WebSocket for audio

## Compliance

- ✅ **Constitution 2.4**: Simplicity (minimal protocol, browser-native)
- ✅ **Constitution 2.7**: Backwards Compatibility (clients can fall back to polling)
- ✅ **Constitution 2.9**: Developer Experience (easy to implement and consume)

## Links

- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Audio Clients Guide](../AUDIO_CLIENTS.md)
- [Project Constitution](../../.specify/memory/constitution.md)
- [PRD Transport Requirements](../PRD.md#transport-layer)
