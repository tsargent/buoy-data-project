# Structured Logging Guidelines

This document describes the logging patterns and standards for the buoy-sonification project per Constitution 2.3 (Observability by Design).

## Log Levels

Fastify uses [pino](https://getpino.io/) with the following standard levels:

| Level | Numeric | Usage                                                  |
| ----- | ------- | ------------------------------------------------------ |
| fatal | 60      | Application cannot continue (immediate ops alert)      |
| error | 50      | Error conditions that affect operations (must review)  |
| warn  | 40      | Warning conditions (degraded but functional)           |
| info  | 30      | General informational messages (default in production) |
| debug | 20      | Debugging information (development only)               |
| trace | 10      | Very detailed traces (development only)                |

## Default Context

Fastify automatically provides:

- `reqId`: Unique request identifier (UUID)
- `req`: Request details (method, url, host, remoteAddress)
- `res`: Response details (statusCode)
- `responseTime`: Request duration in milliseconds

## Adding Custom Context

Use the `request.log` object with additional context:

```typescript
// Log with domain context
request.log.info({ stationId, limit }, "Fetching observations");

// Log business events
request.log.info(
  { stationId: "44009", count: 142 },
  "Station observations retrieved",
);

// Log with error context
request.log.error({ err, stationId }, "Failed to fetch station data");
```

## Route Entry/Exit Patterns

Fastify automatically logs request entry (`incoming request`) and exit (`request completed`) with reqId, status, and timing. **No additional entry/exit logging is required** unless adding domain-specific context:

```typescript
// Optional: Log with business context at entry
app.get("/by-station/:stationId", (req, reply) => {
  const { stationId } = req.params;
  req.log.info({ stationId }, "Processing observation query");

  // ... route logic

  // Fastify will automatically log completion with status + timing
});
```

## PII Handling

**Never log sensitive data** per Constitution 2.7:

- User passwords, tokens, API keys
- Full email addresses (log first 3 chars + domain if needed: `joh...@example.com`)
- Credit card numbers, SSNs
- Full IP addresses in production (log first 2 octets: `192.168.*.*`)

Use Pino's `redact` option for automatic scrubbing:

```typescript
const app = Fastify({
  logger: {
    redact: ["req.headers.authorization", "req.body.password"],
  },
});
```

## Error Logging

The global error handler in `app.ts` already logs all errors with full context. **Do not duplicate error logging** in route handlers:

```typescript
// ❌ BAD - duplicates logging
app.get("/:id", async (req, reply) => {
  try {
    const station = await prisma.station.findUnique({ where: { id } });
    if (!station) {
      req.log.error("Station not found"); // unnecessary
      return reply.code(404).send(createError(...));
    }
  } catch (err) {
    req.log.error(err); // unnecessary - global handler will log
    throw err;
  }
});

// ✅ GOOD - let global handler log errors
app.get("/:id", (req, reply) => {
  const { id } = req.params;
  return prisma.station.findUnique({ where: { id } }).then((station) => {
    if (!station) {
      return reply.code(404).send(createError(ErrorCode.NOT_FOUND, "Station not found"));
    }
    return station;
  });
});
```

## Business Event Logging

Log significant business events at `info` level:

```typescript
// Worker ingestion events
log.info(
  { stationId, recordCount: 1420, durationMs: 342 },
  "NDBC data ingested",
);

// Sonification generation
log.info(
  { stationId, eventCount: 50, algorithm: "wave-to-freq" },
  "Sonification events generated",
);

// Configuration changes
log.info({ previousLimit: 100, newLimit: 500 }, "Query limit increased");
```

## Performance Tracing

Fastify logs `responseTime` automatically. For internal operations, use:

```typescript
const start = process.hrtime.bigint();
// ... operation
const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
request.log.info({ durationMs, recordCount }, "Data processing completed");
```

## Production Configuration

In production, configure minimal logs:

```typescript
const app = Fastify({
  logger: {
    level: "info", // Only info and above
    redact: ["req.headers.authorization"], // Remove sensitive headers
  },
});
```

## Development Configuration

Use verbose logging in development:

```typescript
const app = Fastify({
  logger: {
    level: "debug",
    transport: {
      target: "pino-pretty", // Human-readable formatting
      options: { colorize: true },
    },
  },
});
```

## Query Logging

Constitution 2.5 (Performance Awareness) requires monitoring query performance. Use Prisma middleware:

```typescript
prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  const duration = Date.now() - start;

  if (duration > 100) {
    log.warn(
      {
        model: params.model,
        action: params.action,
        duration,
      },
      "Slow query detected",
    );
  }

  return result;
});
```

## Testing Logs

In tests, suppress logs or validate log output:

```typescript
// Suppress logs in tests
const app = Fastify({ logger: false });

// Or validate specific log entries
const stream = new Writable();
const app = Fastify({ logger: { stream } });
// ... perform test
expect(stream.logs).toContainEqual(
  expect.objectContaining({ level: 30, msg: "Expected log" }),
);
```

## References

- [Pino Documentation](https://getpino.io/)
- [Fastify Logging](https://fastify.dev/docs/latest/Reference/Logging/)
- Constitution 2.3 (Observability by Design)
- Constitution 2.7 (Security Baselines)
