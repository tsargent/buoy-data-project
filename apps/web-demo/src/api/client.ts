/**
 * HTTP client for making API requests with error handling, timeout, and retry logic
 */

import { API_BASE_URL, REQUEST_TIMEOUT } from "../config.js";
import type { ApiError } from "../types.js";

/**
 * Custom error class for API errors
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * Sleep utility for exponential backoff
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generic fetch wrapper with timeout, retry logic, and error handling
 *
 * @param endpoint - API endpoint path (e.g., '/stations')
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Parsed JSON response
 * @throws ApiRequestError on failure after all retries
 */
export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle non-OK responses
        if (!response.ok) {
          let errorData: ApiError | null = null;

          try {
            errorData = (await response.json()) as ApiError;
          } catch {
            // If response is not JSON, use status text
          }

          const message =
            errorData?.message || response.statusText || "Request failed";

          throw new ApiRequestError(
            message,
            response.status,
            errorData?.code,
            errorData?.details
          );
        }

        // Parse JSON response
        try {
          const data = (await response.json()) as T;
          return data;
        } catch (parseError) {
          throw new ApiRequestError(
            "Invalid response from server",
            response.status,
            "PARSE_ERROR",
            parseError
          );
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Handle abort/timeout
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          throw new ApiRequestError(
            "Request timed out, please try again",
            undefined,
            "TIMEOUT"
          );
        }

        throw fetchError;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on specific errors
      if (error instanceof ApiRequestError) {
        // Don't retry on 4xx errors (client errors) except 429 (rate limit)
        if (error.status && error.status >= 400 && error.status < 500) {
          if (error.status !== 429) {
            throw error;
          }
        }

        // Don't retry on timeout for the last attempt
        if (error.code === "TIMEOUT" && attempt === maxRetries) {
          throw error;
        }
      }

      // Don't retry if this was the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      console.warn(
        `API request failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms...`,
        lastError
      );
      await sleep(backoffMs);
    }
  }

  // If we get here, all retries failed
  console.error(`API request failed after ${maxRetries} attempts:`, lastError);

  if (lastError instanceof ApiRequestError) {
    throw lastError;
  }

  // Handle network errors
  throw new ApiRequestError(
    lastError?.message || "Unable to connect to the server",
    undefined,
    "NETWORK_ERROR",
    lastError
  );
}
