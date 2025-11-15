/**
 * API functions for fetching observation data
 */

import { fetchApi } from "./client.js";
import type { Observation, PaginatedResponse } from "../types.js";
import { isValidStationId, ValidationError } from "../utils/validators.js";

/**
 * Fetch the latest observation for a station
 *
 * @param stationId - Station ID
 * @returns Latest observation or null if no observations exist
 * @throws ValidationError if station ID is invalid
 */
export async function getLatestObservation(
  stationId: string
): Promise<Observation | null> {
  // Validate station ID
  if (!isValidStationId(stationId)) {
    throw new ValidationError(
      `Invalid station ID: "${stationId}". Station ID must be a non-empty string.`
    );
  }

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
