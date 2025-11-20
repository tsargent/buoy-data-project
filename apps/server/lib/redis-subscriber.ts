import { z } from "zod";
import { getSubscriber } from "./redis.js";
import { connectionManager } from "./sse-manager.js";
import { logger } from "./logger.js";

/**
 * Schema for observation events published via Redis.
 * Renamed from ObservationMessageSchema to align with specification naming (ObservationEvent).
 * Backwards-compatible alias retained temporarily.
 */
export const ObservationEventSchema = z.object({
  stationId: z.string(),
  timestamp: z.string().datetime(),
  waveHeightM: z.number().nullable(),
  windSpeedMps: z.number().nullable(),
  windDirDeg: z.number().nullable(),
  waterTempC: z.number().nullable(),
  pressureHpa: z.number().nullable(),
});

export type ObservationEvent = z.infer<typeof ObservationEventSchema>;

// Deprecated aliases (to be removed after migration)
export const ObservationMessageSchema = ObservationEventSchema;
export type ObservationMessage = ObservationEvent;

const REDIS_CHANNEL = "observations:new";

/**
 * Initialize the Redis subscriber for observation events.
 *
 * Subscribes to the 'observations:new' channel and broadcasts received
 * observations to all connected SSE clients.
 *
 * Should be called once during server startup.
 */
export async function initializeSubscriber(): Promise<void> {
  const subscriber = getSubscriber();

  // Subscribe to the observations channel
  await subscriber.subscribe(REDIS_CHANNEL, (err, count) => {
    if (err) {
      logger.error(
        {
          event: "redis_subscribe_failed",
          channel: REDIS_CHANNEL,
          error: err.message,
        },
        "Failed to subscribe to Redis channel"
      );
      return;
    }
    logger.info(
      {
        event: "redis_subscribed",
        channel: REDIS_CHANNEL,
        subscriptionCount: count,
      },
      "Subscribed to Redis channel"
    );
  });

  // Handle incoming messages
  subscriber.on("message", (channel: string, message: string) => {
    if (channel !== REDIS_CHANNEL) {
      return;
    }

    const startTime = Date.now();

    try {
      // Parse JSON message
      const data: unknown = JSON.parse(message);

      // Validate observation schema
      const validationResult = ObservationEventSchema.safeParse(data);
      if (!validationResult.success) {
        logger.error(
          {
            event: "redis_validation_failed",
            channel: REDIS_CHANNEL,
            error: validationResult.error.format(),
          },
          "Invalid observation message received"
        );
        return;
      }

      const observation = validationResult.data;

      // Broadcast to all SSE clients
      const clientCount = connectionManager.broadcastToAll(
        "observation",
        observation
      );

      const latency = Date.now() - startTime;
      logger.debug(
        {
          event: "observation_broadcasted",
          channel: REDIS_CHANNEL,
          stationId: observation.stationId,
          clientCount,
          latencyMs: latency,
        },
        "Observation broadcast to SSE clients"
      );

      // Log warning if latency exceeds target
      if (latency > 200) {
        logger.warn(
          {
            event: "broadcast_latency_high",
            stationId: observation.stationId,
            latencyMs: latency,
            targetMs: 200,
          },
          "Broadcast latency exceeded target"
        );
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.error(
          {
            event: "redis_parse_error",
            channel: REDIS_CHANNEL,
            error: error.message,
          },
          "Failed to parse Redis message JSON"
        );
      } else {
        logger.error(
          {
            event: "redis_processing_error",
            channel: REDIS_CHANNEL,
            error: String(error),
          },
          "Error processing Redis message"
        );
      }
    }
  });

  // Handle subscription confirmation
  subscriber.on("subscribe", (channel: string, count: number) => {
    logger.info(
      {
        event: "redis_subscription_confirmed",
        channel,
        subscriptionCount: count,
      },
      "Successfully subscribed to Redis channel"
    );
  });

  // Handle errors
  subscriber.on("error", (err: Error) => {
    logger.error(
      {
        event: "redis_connection_error",
        error: err.message,
      },
      "Redis subscriber connection error"
    );
  });

  // Handle reconnection
  subscriber.on("reconnecting", () => {
    logger.info(
      {
        event: "redis_reconnecting",
      },
      "Reconnecting to Redis"
    );
  });

  logger.info(
    {
      event: "redis_subscriber_initialized",
      channel: REDIS_CHANNEL,
    },
    "Redis subscriber initialization complete"
  );
}

/**
 * Unsubscribe from the observations channel.
 * Should be called during graceful shutdown.
 */
export async function shutdownSubscriber(): Promise<void> {
  const subscriber = getSubscriber();
  await subscriber.unsubscribe(REDIS_CHANNEL);
  logger.info(
    {
      event: "redis_unsubscribed",
      channel: REDIS_CHANNEL,
    },
    "Unsubscribed from Redis channel"
  );
}
