/**
 * API functions for fetching station data
 */

import { fetchApi } from "./client.js";
import type { Station, PaginatedResponse } from "../types.js";

/**
 * Fetch all active stations with pagination
 *
 * @param page - Page number (default: 1)
 * @param limit - Number of items per page (default: 1000)
 * @returns Paginated response with station data
 */
export async function getStations(
  page = 1,
  limit = 1000,
): Promise<PaginatedResponse<Station>> {
  const endpoint = `/v1/stations?page=${page}&limit=${limit}`;
  return fetchApi<PaginatedResponse<Station>>(endpoint);
}

/**
 * Fetch a single station by ID
 *
 * @param id - Station ID
 * @returns Station data
 */
export async function getStation(id: string): Promise<Station> {
  const endpoint = `/v1/stations/${encodeURIComponent(id)}`;
  return fetchApi<Station>(endpoint);
}
