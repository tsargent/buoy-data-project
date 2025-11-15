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
