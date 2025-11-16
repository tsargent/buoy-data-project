/**
 * Standard error codes for API responses
 */
export const ErrorCode = {
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  BAD_REQUEST: "BAD_REQUEST",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Standard error response shape per constitution
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Create a standard error response
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: unknown
): ErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

/**
 * Map HTTP status codes to error codes
 */
export function getStatusForErrorCode(code: ErrorCode): number {
  switch (code) {
    case ErrorCode.NOT_FOUND:
      return 404;
    case ErrorCode.VALIDATION_ERROR:
      return 400;
    case ErrorCode.BAD_REQUEST:
      return 400;
    case ErrorCode.UNAUTHORIZED:
      return 401;
    case ErrorCode.FORBIDDEN:
      return 403;
    case ErrorCode.SERVICE_UNAVAILABLE:
      return 503;
    case ErrorCode.INTERNAL_ERROR:
    default:
      return 500;
  }
}
