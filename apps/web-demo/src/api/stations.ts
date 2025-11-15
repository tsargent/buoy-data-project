/**
 * API functions for fetching station data
 */

import { fetchApi } from "./client.js";
import type { Station, PaginatedResponse } from "../types.js";
import {
  isValidStationId,
  isValidPagination,
  ValidationError,
} from "../utils/validators.js";

/**
 * Fetch all active stations with pagination
 *
 * @param page - Page number (default: 1)
 * @param limit - Number of items per page (default: 1000)
 * @returns Paginated response with station data
 * @throws ValidationError if pagination parameters are invalid
 */
export async function getStations(
  page = 1,
  limit = 1000
): Promise<PaginatedResponse<Station>> {
  // Validate pagination parameters
  if (!isValidPagination(page, limit)) {
    throw new ValidationError(
      `Invalid pagination parameters: page=${page}, limit=${limit}. Page must be >= 1, limit must be > 0 and <= 1000.`
    );
  }

  const endpoint = `/v1/stations?page=${page}&limit=${limit}`;
  return fetchApi<PaginatedResponse<Station>>(endpoint);
}

/**
 * Fetch a single station by ID
 *
 * @param id - Station ID
 * @returns Station data
 * @throws ValidationError if station ID is invalid
 */
export async function getStation(id: string): Promise<Station> {
  // Validate station ID
  if (!isValidStationId(id)) {
    throw new ValidationError(
      `Invalid station ID: "${id}". Station ID must be a non-empty string.`
    );
  }

  const endpoint = `/v1/stations/${encodeURIComponent(id)}`;
  return fetchApi<Station>(endpoint);
}
