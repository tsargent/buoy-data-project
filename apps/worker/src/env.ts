import { z } from "zod";
import { config } from "dotenv";

// Load environment variables
config();

/**
 * Environment variable validation for worker
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  NDBC_API_BASE: z
    .string()
    .url()
    .default("https://www.ndbc.noaa.gov/data/realtime2"),
  INGEST_INTERVAL_MS: z.coerce.number().default(300000), // 5 minutes
});

export const env = envSchema.parse(process.env);
