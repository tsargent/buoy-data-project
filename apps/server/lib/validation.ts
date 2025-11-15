import { z } from "zod";

/**
 * Pagination query parameters
 */
export const PaginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => Math.max(Number(val), 1))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "page must be a positive number",
    }),
  limit: z
    .string()
    .optional()
    .default("100")
    .transform((val) => Math.min(Number(val), 500)) // Cap at 500 per constitution
    .refine((val) => !isNaN(val) && val > 0, {
      message: "limit must be a positive number",
    }),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Query params for /observations/by-station/:stationId
 */
export const ObservationQuerySchema = z
  .object({
    since: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val) return true;
          const date = new Date(val);
          return !isNaN(date.getTime());
        },
        {
          message: "since must be a valid ISO 8601 date string",
        },
      ),
  })
  .merge(PaginationQuerySchema);

export type ObservationQuery = z.infer<typeof ObservationQuerySchema>;

/**
 * Path params for /stations/:id
 */
export const StationParamsSchema = z.object({
  id: z.string().min(1, "Station ID is required"),
});

export type StationParams = z.infer<typeof StationParamsSchema>;

/**
 * Path params for /observations.by-station/:stationId
 */
export const ObservationParamsSchema = z.object({
  stationId: z.string().min(1, "Station ID is required"),
});

export type ObservationParams = z.infer<typeof ObservationParamsSchema>;

/**
 * Pagination metadata for paginated responses
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
