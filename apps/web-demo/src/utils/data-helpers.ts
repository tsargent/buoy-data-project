/**
 * Data formatting and helper utilities
 */

/**
 * Format sensor value with unit, handling null values
 *
 * @param value - Sensor reading value (can be null)
 * @param unit - Unit string (e.g., "m", "m/s", "°C")
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted value string or "Not Available"
 */
export function formatValue(
  value: number | null,
  unit: string,
  precision = 2
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "Not Available";
  }

  return `${value.toFixed(precision)} ${unit}`;
}

/**
 * Format wind direction in degrees to compass direction
 *
 * @param degrees - Wind direction in degrees (0-360)
 * @returns Compass direction string (e.g., "N", "NE", "E")
 */
export function formatWindDirection(degrees: number | null): string {
  if (degrees === null || degrees === undefined || isNaN(degrees)) {
    return "Not Available";
  }

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(degrees / 45) % 8;
  return `${degrees.toFixed(0)}° (${directions[index]})`;
}
