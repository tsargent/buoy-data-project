import { Registry, Counter, Histogram, Gauge } from "prom-client";

/**
 * Prometheus metrics registry and collectors
 * Constitution 2.3: Observability as a Design Input
 */

export const register = new Registry();

// HTTP request metrics
export const httpRequestCounter = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// Domain-specific metrics
export const observationsQueriedCounter = new Counter({
  name: "observations_queried_total",
  help: "Total number of observations returned by queries",
  labelNames: ["station_id"],
  registers: [register],
});

export const stationsActiveGauge = new Gauge({
  name: "stations_active",
  help: "Number of active stations in the system",
  registers: [register],
});

// Database query metrics
export const dbQueryDuration = new Histogram({
  name: "db_query_duration_seconds",
  help: "Database query latency in seconds",
  labelNames: ["model", "operation"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const dbQueryErrorCounter = new Counter({
  name: "db_query_errors_total",
  help: "Total number of database query errors",
  labelNames: ["model", "operation", "error_type"],
  registers: [register],
});

// SSE streaming metrics
export const sseConnectionsGauge = new Gauge({
  name: "sse_connections_total",
  help: "Number of active SSE connections",
  registers: [register],
});

export const sseEventsSentCounter = new Counter({
  name: "sse_events_sent_total",
  help: "Total number of SSE events sent",
  labelNames: ["event_type"],
  registers: [register],
});

export const sseConnectionDurationHistogram = new Histogram({
  name: "sse_connection_duration_seconds",
  help: "Duration of SSE connections in seconds",
  buckets: [1, 10, 30, 60, 300, 600, 1800, 3600],
  registers: [register],
});

export const sseBroadcastLatencyHistogram = new Histogram({
  name: "sse_broadcast_latency_ms",
  help: "Time to broadcast event to all clients in milliseconds",
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  registers: [register],
});

export const sseBroadcastErrorsCounter = new Counter({
  name: "sse_broadcast_errors_total",
  help: "Total number of broadcast errors",
  labelNames: ["reason"], // json_parse | schema_invalid | write_failed
  registers: [register],
});

export const sseReconnectLatencyHistogram = new Histogram({
  name: "sse_reconnect_latency_seconds",
  help: "Latency between disconnect and next connection event",
  buckets: [0.5, 1, 2, 3, 5, 8],
  registers: [register],
});
