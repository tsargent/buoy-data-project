/**
 * Type definitions for API responses and data models
 */

/**
 * Station represents a buoy station location
 * Matches the Prisma Station model
 */
export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
  source: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastObservationAt?: string; // Optional field for data freshness (added in Task 4.0)
}

/**
 * Observation represents sensor data from a buoy station
 * Matches the Prisma Observation model
 */
export interface Observation {
  id: string;
  stationId: string;
  observedAt: string;
  waveHeightM: number | null;
  windSpeedMps: number | null;
  windDirDeg: number | null;
  waterTempC: number | null;
  pressureHpa: number | null;
  createdAt: string;
}

/**
 * Generic paginated response wrapper
 * Used by all paginated API endpoints
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * API error response structure
 * Used for consistent error handling across the application
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Data freshness categories for marker color coding
 */
export enum DataFreshness {
  FRESH = "fresh", // < 6 hours
  AGING = "aging", // 6-24 hours
  STALE = "stale", // > 24 hours or error
}

/**
 * Marker colors corresponding to data freshness
 */
export const FRESHNESS_COLORS = {
  [DataFreshness.FRESH]: "green",
  [DataFreshness.AGING]: "yellow",
  [DataFreshness.STALE]: "gray",
} as const;
