/**
 * API functions for fetching observation data
 */

import { fetchApi } from "./client.js";
import type { Observation, PaginatedResponse } from "../types.js";

/**
 * Fetch the latest observation for a station
 *
 * @param stationId - Station ID
 * @returns Latest observation or null if no observations exist
 */
export async function getLatestObservation(
  stationId: string
): Promise<Observation | null> {
  try {
    const endpoint = `/v1/observations/by-station/${encodeURIComponent(stationId)}?limit=1&page=1`;
    const response = await fetchApi<PaginatedResponse<Observation>>(endpoint);

    // Return first observation or null if empty
    return response.data.length > 0 ? response.data[0] : null;
  } catch (error) {
    // Log error but return null to allow graceful handling
    console.error(
      `Failed to fetch latest observation for station ${stationId}:`,
      error
    );
    return null;
  }
}
