/**
 * Popup content builder for station markers
 */

import type { Station, Observation } from "../types.js";
import { formatTimestamp } from "../utils/date-formatter.js";
import { formatValue, formatWindDirection } from "../utils/data-helpers.js";

/**
 * Build HTML content for station popup
 *
 * @param station - Station data
 * @param observation - Optional observation data
 * @returns HTML string for popup content
 */
export function buildStationPopup(
  station: Station,
  observation?: Observation | null
): string {
  const observationHtml = observation
    ? buildObservationHtml(observation)
    : '<p class="loading-text">Loading observation data...</p>';

  return `
    <div class="station-popup">
      <h3 class="station-name">${escapeHtml(station.name)}</h3>
      <div class="station-details">
        <p><strong>Station ID:</strong> ${escapeHtml(station.id)}</p>
        <p><strong>Location:</strong> ${station.lat.toFixed(4)}°, ${station.lon.toFixed(4)}°</p>
      </div>
      <div class="observation-data">
        ${observationHtml}
      </div>
    </div>
  `;
}

/**
 * Build HTML for observation data
 *
 * @param observation - Observation data
 * @returns HTML string for observation section
 */
function buildObservationHtml(observation: Observation): string {
  return `
    <h4>Latest Observation</h4>
    <p class="observation-time"><strong>Observed:</strong> ${formatTimestamp(observation.observedAt)}</p>
    <div class="sensor-readings">
      <p><strong>Wave Height:</strong> ${formatValue(observation.waveHeightM, "m")}</p>
      <p><strong>Wind Speed:</strong> ${formatValue(observation.windSpeedMps, "m/s")}</p>
      <p><strong>Wind Direction:</strong> ${formatWindDirection(observation.windDirDeg)}</p>
      <p><strong>Water Temperature:</strong> ${formatValue(observation.waterTempC, "°C", 1)}</p>
      <p><strong>Air Pressure:</strong> ${formatValue(observation.pressureHpa, "hPa", 1)}</p>
    </div>
  `;
}

/**
 * Build HTML for error state
 *
 * @returns HTML string for error message
 */
export function buildObservationError(): string {
  return '<p class="error-text">No observation data available</p>';
}

/**
 * Escape HTML to prevent XSS attacks
 *
 * @param text - Text to escape
 * @returns Escaped HTML string
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
