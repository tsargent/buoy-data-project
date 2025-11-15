/**
 * Popup content builder for station markers
 */

import type { Station } from "../types.js";

/**
 * Build HTML content for station popup
 *
 * @param station - Station data
 * @returns HTML string for popup content
 */
export function buildStationPopup(station: Station): string {
  return `
    <div class="station-popup">
      <h3 class="station-name">${escapeHtml(station.name)}</h3>
      <div class="station-details">
        <p><strong>Station ID:</strong> ${escapeHtml(station.id)}</p>
        <p><strong>Location:</strong> ${station.lat.toFixed(4)}°, ${station.lon.toFixed(4)}°</p>
      </div>
      <div class="observation-data">
        <p class="loading-text">Loading observation data...</p>
      </div>
    </div>
  `;
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
