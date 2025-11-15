import { z } from "zod";

/**
 * NDBC Standard Meteorological Data Format (.txt)
 * Spec: https://www.ndbc.noaa.gov/measdes.shtml
 */

// Raw NDBC observation line schema
export const NDBCObservationSchema = z.object({
  // Date/Time (UTC)
  year: z.coerce.number(),
  month: z.coerce.number(),
  day: z.coerce.number(),
  hour: z.coerce.number(),
  minute: z.coerce.number(),

  // Measurements (999 or 9999 = missing)
  waveHeight: z.coerce.number().transform((v) => (v === 99 ? null : v)), // WVHT (m)
  dominantPeriod: z.coerce.number().transform((v) => (v === 99 ? null : v)), // DPD (sec)
  averagePeriod: z.coerce.number().transform((v) => (v === 99 ? null : v)), // APD (sec)
  meanWaveDirection: z.coerce.number().transform((v) => (v === 999 ? null : v)), // MWD (deg)
  pressure: z.coerce.number().transform((v) => (v === 9999 ? null : v)), // PRES (hPa)
  airTemp: z.coerce.number().transform((v) => (v === 999 ? null : v)), // ATMP (°C)
  waterTemp: z.coerce.number().transform((v) => (v === 999 ? null : v)), // WTMP (°C)
  dewPoint: z.coerce.number().transform((v) => (v === 999 ? null : v)), // DEWP (°C)
  visibility: z.coerce.number().transform((v) => (v === 99 ? null : v)), // VIS (nmi)
  windDirection: z.coerce.number().transform((v) => (v === 999 ? null : v)), // WDIR (deg)
  windSpeed: z.coerce.number().transform((v) => (v === 99 ? null : v)), // WSPD (m/s)
  gustSpeed: z.coerce.number().transform((v) => (v === 99 ? null : v)), // GST (m/s)
});

export type NDBCObservation = z.infer<typeof NDBCObservationSchema>;

/**
 * Parse NDBC .txt file content
 * Format: Space-delimited, first row is headers, second row is units
 * Example:
 * #YY  MM DD hh mm WVHT  DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS  WDIR WSPD GST
 * #yr  mo dy hr mn    m  sec   sec degT   hPa  degC  degC  degC  nmi degT  m/s m/s
 * 2025 11 14 00 00  1.2  5.00  3.70 270 1013.2  12.5  13.1  11.2   99  180  8.5 10.2
 */
export function parseNDBCFile(content: string): NDBCObservation[] {
  const lines = content
    .split("\n")
    .filter((line) => !line.startsWith("#") && line.trim());

  return lines.slice(2).map((line) => {
    const parts = line.trim().split(/\s+/);
    const [
      year,
      month,
      day,
      hour,
      minute,
      waveHeight,
      dominantPeriod,
      averagePeriod,
      meanWaveDirection,
      pressure,
      airTemp,
      waterTemp,
      dewPoint,
      visibility,
      windDirection,
      windSpeed,
      gustSpeed,
    ] = parts;

    return NDBCObservationSchema.parse({
      year,
      month,
      day,
      hour,
      minute,
      waveHeight,
      dominantPeriod,
      averagePeriod,
      meanWaveDirection,
      pressure,
      airTemp,
      waterTemp,
      dewPoint,
      visibility,
      windDirection,
      windSpeed,
      gustSpeed,
    });
  });
}
