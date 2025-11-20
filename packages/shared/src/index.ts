import { z } from "zod";
export * from "./events";

export const StationSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
});
export type Station = z.infer<typeof StationSchema>;

// Database-level observation record (not the streaming event)
export const ObservationSchema = z.object({
  id: z.string(),
  stationId: z.string(),
  observedAt: z.string().datetime(),
  waveHeightM: z.number().nullable().optional(),
  windSpeedMps: z.number().nullable().optional(),
  windDirDeg: z.number().nullable().optional(),
  waterTempC: z.number().nullable().optional(),
  pressureHpa: z.number().nullable().optional(),
});
export type Observation = z.infer<typeof ObservationSchema>;
