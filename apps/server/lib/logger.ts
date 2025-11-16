/**
 * Structured logger for infrastructure components that don't have request context.
 *
 * Route handlers should use `request.log` instead of this logger.
 */

interface LogContext {
  [key: string]: unknown;
}

function logStructured(
  level: string,
  context: LogContext,
  message: string
): void {
  const logEntry = {
    level,
    time: Date.now(),
    ...context,
    msg: message,
  };

  if (level === "error") {
    console.error(JSON.stringify(logEntry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(logEntry));
  } else if (level === "debug") {
    console.debug(JSON.stringify(logEntry));
  } else {
    console.info(JSON.stringify(logEntry));
  }
}

export const logger = {
  info: (context: LogContext, message: string) =>
    logStructured("info", context, message),
  error: (context: LogContext, message: string) =>
    logStructured("error", context, message),
  warn: (context: LogContext, message: string) =>
    logStructured("warn", context, message),
  debug: (context: LogContext, message: string) =>
    logStructured("debug", context, message),
};
