import { z } from "zod";

/**
 * NDBC Standard Meteorological Data Format (.txt)
 * Spec: https://www.ndbc.noaa.gov/measdes.shtml
 */

/**
 * Helper to convert string to number or null
 * Handles missing values: MM, 999, 9999, or actual NaN
 */
function parseNumberOrNull(value: string | undefined): number | null {
  if (!value || value === "MM" || value === "999" || value === "9999") {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// Raw NDBC observation line schema
export const NDBCObservationSchema = z.object({
  // Date/Time (UTC)
  year: z.coerce.number(),
  month: z.coerce.number(),
  day: z.coerce.number(),
  hour: z.coerce.number(),
  minute: z.coerce.number(),

  // Measurements (optional, can be null if sensor missing/failed)
  waveHeight: z.number().nullable(), // WVHT (m)
  dominantPeriod: z.number().nullable(), // DPD (sec)
  averagePeriod: z.number().nullable(), // APD (sec)
  meanWaveDirection: z.number().nullable(), // MWD (deg)
  pressure: z.number().nullable(), // PRES (hPa)
  airTemp: z.number().nullable(), // ATMP (°C)
  waterTemp: z.number().nullable(), // WTMP (°C)
  dewPoint: z.number().nullable(), // DEWP (°C)
  visibility: z.number().nullable(), // VIS (nmi)
  windDirection: z.number().nullable(), // WDIR (deg)
  windSpeed: z.number().nullable(), // WSPD (m/s)
  gustSpeed: z.number().nullable(), // GST (m/s)
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
      waveHeight: parseNumberOrNull(waveHeight),
      dominantPeriod: parseNumberOrNull(dominantPeriod),
      averagePeriod: parseNumberOrNull(averagePeriod),
      meanWaveDirection: parseNumberOrNull(meanWaveDirection),
      pressure: parseNumberOrNull(pressure),
      airTemp: parseNumberOrNull(airTemp),
      waterTemp: parseNumberOrNull(waterTemp),
      dewPoint: parseNumberOrNull(dewPoint),
      visibility: parseNumberOrNull(visibility),
      windDirection: parseNumberOrNull(windDirection),
      windSpeed: parseNumberOrNull(windSpeed),
      gustSpeed: parseNumberOrNull(gustSpeed),
    });
  });
}
