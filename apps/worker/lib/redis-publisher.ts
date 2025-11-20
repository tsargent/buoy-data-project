import Redis from "ioredis";
import { env } from "../src/env.js";
import { logger } from "./logger.js";
import { ObservationEvent } from "@pkg/shared";

/**
 * Redis publisher for observation events.
 *
 * Publishes new observations to the 'observations:new' channel
 * for real-time streaming to SSE clients.
 */

let publisherClient: Redis | null = null;

const REDIS_CHANNEL = "observations:new";
const MAX_PUBLISH_RETRIES = 3;
const RETRY_BASE_DELAY = 100; // 100ms

/**
 * Get the Redis publisher client (singleton).
 * Creates the client on first call.
 */
export function getPublisher(): Redis {
  if (!publisherClient) {
    publisherClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error(
            {
              event: "redis_max_retries_exceeded",
              attempts: times,
            },
            "Redis max reconnection attempts reached"
          );
          return null;
        }
        const delay = Math.min(RETRY_BASE_DELAY * Math.pow(2, times), 5000);
        logger.warn(
          {
            event: "redis_reconnecting",
            attempt: times,
            delayMs: delay,
          },
          "Reconnecting to Redis"
        );
        return delay;
      },
    });

    publisherClient.on("connect", () => {
      logger.info(
        {
          event: "redis_connected",
          url: env.REDIS_URL,
        },
        "Connected to Redis"
      );
    });

    publisherClient.on("error", (error: Error) => {
      logger.error(
        {
          event: "redis_connection_error",
          error: error.message,
        },
        "Redis connection error"
      );
    });

    publisherClient.on("close", () => {
      logger.warn(
        {
          event: "redis_connection_closed",
        },
        "Redis connection closed"
      );
    });
  }

  return publisherClient;
}

// Deprecated alias (remove after downstream updates)
export type ObservationMessage = ObservationEvent;

/**
 * Publish an observation to Redis for real-time streaming.
 *
 * @param observation - The observation data to publish
 * @returns Promise that resolves when publish succeeds
 *
 * Uses retry logic for transient failures. Logs errors but doesn't throw
 * to prevent database insert failures from being rolled back.
 */
export async function publishObservation(
  observation: ObservationEvent
): Promise<void> {
  const publisher = getPublisher();
  const message = JSON.stringify(observation);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_PUBLISH_RETRIES; attempt++) {
    try {
      // Publish to Redis channel
      await publisher.publish(REDIS_CHANNEL, message);

      logger.debug(
        {
          event: "observation_published",
          channel: REDIS_CHANNEL,
          stationId: observation.stationId,
          attempt,
        },
        "Published observation to Redis"
      );

      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_PUBLISH_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
        logger.warn(
          {
            event: "publish_retry",
            channel: REDIS_CHANNEL,
            stationId: observation.stationId,
            attempt,
            maxAttempts: MAX_PUBLISH_RETRIES,
            delayMs: delay,
            error: lastError.message,
          },
          "Publish failed, retrying"
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  logger.error(
    {
      event: "publish_failed",
      channel: REDIS_CHANNEL,
      stationId: observation.stationId,
      maxAttempts: MAX_PUBLISH_RETRIES,
      error: lastError?.message,
    },
    "Failed to publish observation after all retries"
  );

  // Don't throw - we don't want to fail the database insert
  // The observation is still saved, just not broadcast in real-time
}

/**
 * Gracefully shutdown the Redis publisher.
 */
export async function shutdownPublisher(): Promise<void> {
  if (publisherClient) {
    await publisherClient.quit();
    logger.info(
      {
        event: "redis_publisher_shutdown",
      },
      "Redis publisher connection closed"
    );
  }
}
