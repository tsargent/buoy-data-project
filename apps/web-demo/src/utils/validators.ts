/**
 * Input validation utilities for client-side validation
 */

/**
 * Validate station ID format
 * Station IDs should be non-empty strings
 *
 * @param id - Station ID to validate
 * @returns True if valid
 */
export function isValidStationId(id: string): boolean {
  return typeof id === "string" && id.trim().length > 0;
}

/**
 * Validate latitude value
 * Latitude must be between -90 and 90
 *
 * @param lat - Latitude value to validate
 * @returns True if valid
 */
export function isValidLatitude(lat: number): boolean {
  return (
    typeof lat === "number" &&
    !isNaN(lat) &&
    isFinite(lat) &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * Validate longitude value
 * Longitude must be between -180 and 180
 *
 * @param lng - Longitude value to validate
 * @returns True if valid
 */
export function isValidLongitude(lng: number): boolean {
  return (
    typeof lng === "number" &&
    !isNaN(lng) &&
    isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Validate pagination parameters
 * Page must be >= 1, limit must be > 0
 *
 * @param page - Page number to validate
 * @param limit - Items per page to validate
 * @returns True if both parameters are valid
 */
export function isValidPagination(page: number, limit: number): boolean {
  return (
    typeof page === "number" &&
    typeof limit === "number" &&
    !isNaN(page) &&
    !isNaN(limit) &&
    isFinite(page) &&
    isFinite(limit) &&
    page >= 1 &&
    limit > 0 &&
    limit <= 1000 // Reasonable max limit
  );
}

/**
 * Validation error for invalid input
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
