import { z } from "zod";

/**
 * ConnectionEvent represents the initial event sent to clients upon establishing
 * an SSE connection. It confirms stream readiness and provides a timestamp.
 */
export const ConnectionEventSchema = z.object({
  status: z.literal("connected"),
  timestamp: z.string().datetime(),
});
export type ConnectionEvent = z.infer<typeof ConnectionEventSchema>;

/**
 * ObservationEvent is the streaming payload broadcast to SSE clients.
 * Matches specification FR-004 field naming.
 */
export const ObservationEventSchema = z.object({
  stationId: z.string(),
  timestamp: z.string().datetime(),
  // publishedAt is the server-side emission timestamp used for end-to-end latency measurement
  // Added per Task 2.5 (NFR-Latency). Always ISO 8601.
  publishedAt: z.string().datetime(),
  waveHeightM: z.number().nullable(),
  windSpeedMps: z.number().nullable(),
  windDirDeg: z.number().nullable(),
  waterTempC: z.number().nullable(),
  pressureHpa: z.number().nullable(),
});
export type ObservationEvent = z.infer<typeof ObservationEventSchema>;

// Deprecated alias retained temporarily for migration (remove after downstream cleanup)
export type ObservationMessage = ObservationEvent;
