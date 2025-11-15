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
 * Parse error response from API
 */
async function parseErrorResponse(
  response: Response
): Promise<ApiError | null> {
  try {
    return (await response.json()) as ApiError;
  } catch {
    return null;
  }
}

/**
 * Create error from non-OK response
 */
async function createResponseError(
  response: Response
): Promise<ApiRequestError> {
  const errorData = await parseErrorResponse(response);
  const message = errorData?.message || response.statusText || "Request failed";

  return new ApiRequestError(
    message,
    response.status,
    errorData?.code,
    errorData?.details
  );
}

/**
 * Parse JSON response with error handling
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (parseError) {
    throw new ApiRequestError(
      "Invalid response from server",
      response.status,
      "PARSE_ERROR",
      parseError
    );
  }
}

/**
 * Make a single fetch request with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (fetchError) {
    clearTimeout(timeoutId);

    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      throw new ApiRequestError(
        "Request timed out, please try again",
        undefined,
        "TIMEOUT"
      );
    }

    throw fetchError;
  }
}

/**
 * Check if error should be retried
 */
function shouldRetryError(
  error: unknown,
  attempt: number,
  maxRetries: number
): boolean {
  if (!(error instanceof ApiRequestError)) {
    return true;
  }

  // Don't retry on 4xx errors except 429 (rate limit)
  if (error.status && error.status >= 400 && error.status < 500) {
    return error.status === 429;
  }

  // Don't retry timeout on last attempt
  if (error.code === "TIMEOUT" && attempt === maxRetries) {
    return false;
  }

  return true;
}

/**
 * Handle retry logic with exponential backoff
 */
async function handleRetry(
  error: unknown,
  attempt: number,
  maxRetries: number
): Promise<Error> {
  const lastError = error instanceof Error ? error : new Error(String(error));

  if (!shouldRetryError(error, attempt, maxRetries)) {
    throw error;
  }

  if (attempt < maxRetries) {
    const backoffMs = Math.pow(2, attempt - 1) * 1000;
    console.warn(
      `API request failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms...`,
      lastError
    );
    await sleep(backoffMs);
  }

  return lastError;
}

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
      const response = await fetchWithTimeout(url, options);

      if (!response.ok) {
        throw await createResponseError(response);
      }

      return await parseJsonResponse<T>(response);
    } catch (error) {
      lastError = await handleRetry(error, attempt, maxRetries);
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
