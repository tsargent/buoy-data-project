# ADR 002: Use BullMQ for Background Job Processing

**Status**: Accepted  
**Date**: 2025-11-14  
**Deciders**: Tyler Sargent  
**Technical Story**: Phase 2 worker implementation for NOAA data ingestion

## Context and Problem Statement

The buoy sonification project requires a robust background job system to periodically fetch observation data from NOAA buoys and insert it into the database. The solution must be reliable, scalable, and provide visibility into job execution.

## Decision Drivers

- **Reliability**: Jobs must not be lost, support retries on failure
- **Scheduling**: Cron-like scheduling for periodic ingestion
- **Observability**: Visibility into job status, failures, and performance
- **TypeScript Support**: First-class TypeScript integration
- **Redis-backed**: Leverage existing Redis infrastructure (used for rate limiting)
- **Constitution Alignment**: Supports "Observability as Design Input" (2.3)

## Considered Options

1. **BullMQ** - Modern Redis-based queue with TypeScript support
2. **Agenda** - MongoDB-based job scheduler
3. **Bee-Queue** - Simple Redis-based queue

## Decision Outcome

**Chosen option**: BullMQ

### Positive Consequences

- **Strong TypeScript support**: Full type inference for jobs and results
- **Redis-backed**: Shares Redis instance with rate limiting (efficient resource use)
- **Rich features**: Retries, delays, priorities, rate limiting, repeatable jobs
- **Excellent observability**: Job progress tracking, event hooks, integration with Bull Board UI
- **Active maintenance**: Modern, well-maintained library (successor to Bull)
- **Cron scheduling**: Built-in cron syntax for periodic jobs

### Negative Consequences

- **Redis dependency**: Requires Redis infrastructure (mitigated: already in use)
- **Complexity**: More features than simple use case requires
- **Learning curve**: Configuration options can be overwhelming

## Pros and Cons of Other Options

### Agenda

- ✅ MongoDB-backed (familiar to some teams)
- ✅ Simple API
- ❌ Requires MongoDB (introduces new dependency)
- ❌ Less active maintenance than BullMQ
- ❌ Weaker TypeScript support

### Bee-Queue

- ✅ Lightweight, simple
- ✅ Redis-backed
- ❌ Limited features (no cron, no repeatable jobs)
- ❌ Minimal TypeScript support
- ❌ Less active maintenance

## Implementation Notes

### Worker Setup

```typescript
// apps/worker/src/index.ts
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const queue = new Queue("ndbc-ingestion", { connection });

// Add repeatable job
await queue.add(
  "ingest-all-stations",
  {},
  {
    repeat: {
      pattern: "*/15 * * * *", // Every 15 minutes
    },
  },
);

// Worker
const worker = new Worker(
  "ndbc-ingestion",
  async (job) => {
    console.log(`Processing job ${job.id}`);
    await ingestNDBCData();
  },
  {
    connection,
    concurrency: 1,
  },
);
```

### Job Configuration

```typescript
// Retry configuration
{
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // Start with 5s
  },
}
```

### Observability

```typescript
// Job lifecycle events
worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

worker.on("progress", (job, progress) => {
  console.log(`Job ${job.id} progress: ${progress}%`);
});
```

## Compliance

- ✅ **Constitution 2.3**: Observability as Design Input (job events, progress tracking)
- ✅ **Constitution 2.4**: Simplicity (focused on one job type, minimal configuration)
- ✅ **Constitution 2.5**: Performance Awareness (rate limiting, concurrency control)

## Alternatives Considered for Future

- **Message brokers** (RabbitMQ, Kafka): Overkill for current scale
- **Cloud-native queues** (AWS SQS, Google Pub/Sub): Vendor lock-in, higher cost
- **Cron + Docker**: Less visibility, no retry logic, harder to scale

## Links

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Worker Implementation](../../apps/worker/src/index.ts)
- [Project Constitution](../../.specify/memory/constitution.md)
