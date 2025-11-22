# Observability Specification (Feature 002 Real-Time Stream)

Status: Draft (Task 0.6)

## Purpose
Defines required metrics, structured log events, and validation procedures ensuring streaming latency, reliability, and reconnection behavior can be measured against spec FR-009 and related NFRs before production.

## Metrics
| Name | Type | Labels | Description | Acceptance / Threshold | Collection Point |
|------|------|--------|-------------|------------------------|------------------|
| `sse_connections_total` | Counter | `status` ("opened"|"closed") | Tracks number of SSE connections opened/closed. | Count increments on each open/close; no drops. | In `addClient` / `removeClient` functions.
| `sse_connection_duration_seconds` | Histogram | none | Duration of each SSE connection from open to close. | Used to derive p95 disconnect stability; no enforced threshold yet. | On connection close.
| `sse_events_sent_total` | Counter | `eventType` ("connection","observation","error") | Total SSE events successfully written. | Must increment per event; value parity with broadcast attempts minus failures. | After successful broadcast write.
| `sse_broadcast_latency_ms` | Histogram | `eventType` | Measures publish→all-client write loop latency (broadcast loop latency). | p95 ≤ 150ms (FR-009 part 2). | Around broadcast function (start before iteration, end after writes).
| `sse_reconnect_latency_seconds` | Histogram | none | Time from client disconnect to successful reconnection (for reconnection tests). | p95 ≤ 2.0s under simulated 10-client churn. | On reconnection success (planned Task 8.5).
| `sse_validation_failures_total` | Counter | `entity` ("observation","params") | Counts validation failures. | Non-zero allowed; must accompany structured error; used for monitoring data quality. | In validation guard code.
| `process_rss_bytes` | Gauge | none | Resident set size memory usage. | RSS delta over 10→50 clients ≤ 50MB. | Polled every 10s in instrumentation task.

## Structured Logs
All logs emitted via `pino` with JSON structure. Required event types:

| Event | Level | Required Keys | When |
|-------|-------|---------------|------|
| `sse_client_added` | debug | `connectionCount` | After connection registered.
| `sse_client_removed` | debug | `connectionCount`,`durationMs` | After removal.
| `sse_broadcast` | debug | `eventType`,`clientCount`,`successCount` | After broadcast loop completes.
| `sse_write_failed` | warn | `error` | On per-client write failure before removal.
| `sse_connection_error` | warn | `error` | Unexpected connection lifecycle error.
| `sse_reconnect_attempt` | info | `attempt` | Client begins reconnection (test harness instrumentation).
| `sse_reconnect_success` | info | `latencyMs` | Successful reconnection; used for histogram population.
| `validation_failed` | warn | `entity`,`details` | Schema or parameter validation failure.
| `sse_latency_sample` | debug | `eventType`,`latencyMs` | Optional per-event sample prior to histogram aggregation (only if needed for troubleshooting).

## Sampling & Cardinality Rules
- Avoid high-cardinality labels; metrics do not include connection IDs.
- Log lines may include transient `reqId` from Fastify for trace correlation.
- Broadcast latency histogram buckets: `[5,10,25,50,75,100,125,150,200,300]` ms.
- Reconnect latency histogram buckets: `[0.25,0.5,0.75,1,1.5,2,3,5]` seconds.

## Validation Procedures
1. Smoke Test (Task 0.3): Initially fails until SSE route and broadcast path operational; once green, extend to assert `sse_events_sent_total` increments for a connection + observation event.
2. Parity Test (Task 0.7): Ensures schema/interface parity for all event payloads & error shapes (already implemented).
3. Latency Baseline Script (Task 2.4): Collect 30 sequential observation publishes; record p50/p95 for broadcast loop; persists JSON report under `specs/002-realtime-stream/test-results/latency-baseline.json`.
4. Load Test (Tasks 6.1/6.2): Run 10 and then 50 concurrent clients; capture metrics snapshots (Prometheus scrape or internal aggregation API) verifying thresholds:
   - `sse_broadcast_latency_ms` p95 ≤ 150ms
   - No negative delta in `sse_events_sent_total` (monotonic)
   - RSS growth ≤ 50MB.
5. Reconnection Test (Task 8.5): Force disconnect (close TCP) for subset of clients; measure `sse_reconnect_latency_seconds` histogram p95 ≤ 2s.
6. Data Loss Check: Compare count of published observation messages vs successes in `sse_events_sent_total{eventType="observation"}` for test window (allowing for open connections only). Expect equality.

## Metric Exposure
- Endpoint: `/metrics` (Fastify route) exposing Prometheus registry.
- Registry initialization lives in a dedicated `metrics.ts` module imported by server bootstrap; histograms/counters registered once.

## Acceptance Criteria (Task 0.6)
- This document exists and references every metric & log event required by spec FR-009 & NFR latency/reliability definitions.
- Latency thresholds and buckets are explicit and testable.
- Validation procedures enumerate artifact output paths.
- Next tasks (7.x, 8.5) can implement instrumentation without ambiguity.

## Traceability Mapping
| Requirement | Metric/Log Link |
|-------------|-----------------|
| FR-009 latency | `sse_broadcast_latency_ms`, baseline script, load test p95 check |
| Reconnect behavior | `sse_reconnect_latency_seconds`, reconnect logs |
| Zero data loss | `sse_events_sent_total` vs publish count; broadcast logs |
| Concurrency stability | RSS gauge + load test logs + connection counters |
| Error shape integrity | `validation_failed` + `sse_events_sent_total{eventType="error"}` |

## Future Extensions
- Add histogram for end-to-end latency (publish to client receipt) once per-client timing capture is implemented.
- Consider OpenTelemetry spans for publish→broadcast pipeline after initial success criteria met.

---
Created as part of remediation to reduce ambiguity prior to instrumentation (Task 0.6).
