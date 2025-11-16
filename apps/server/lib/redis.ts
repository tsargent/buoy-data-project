import Redis from "ioredis";
import { env } from "../src/env.js";

/**
 * Redis client configuration for pub/sub functionality.
 *
 * Redis Pub/Sub requires separate connections for publisher and subscriber.
 * This module provides singleton instances for both.
 */

let publisherClient: Redis | null = null;
let subscriberClient: Redis | null = null;

const RECONNECT_BASE_DELAY = 100; // 100ms
const RECONNECT_MAX_DELAY = 5000; // 5s
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Create a Redis client with connection error handling and reconnection logic.
 */
function createRedisClient(role: "publisher" | "subscriber"): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required for pub/sub
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      if (times > MAX_RECONNECT_ATTEMPTS) {
        console.error(
          `[Redis ${role}] Max reconnection attempts reached, giving up`
        );
        return null; // Stop retrying
      }
      const delay = Math.min(
        RECONNECT_BASE_DELAY * Math.pow(2, times),
        RECONNECT_MAX_DELAY
      );
      console.warn(
        `[Redis ${role}] Reconnecting in ${delay}ms (attempt ${times})`
      );
      return delay;
    },
  });

  client.on("connect", () => {
    console.info(`[Redis ${role}] Connected to ${env.REDIS_URL}`);
  });

  client.on("ready", () => {
    console.info(`[Redis ${role}] Ready for operations`);
  });

  client.on("error", (error: Error) => {
    console.error(`[Redis ${role}] Connection error:`, error.message);
  });

  client.on("close", () => {
    console.warn(`[Redis ${role}] Connection closed`);
  });

  client.on("reconnecting", () => {
    console.info(`[Redis ${role}] Reconnecting...`);
  });

  return client;
}

/**
 * Get the Redis publisher client (singleton).
 * Creates the client on first call.
 */
export function getPublisher(): Redis {
  if (!publisherClient) {
    publisherClient = createRedisClient("publisher");
  }
  return publisherClient;
}

/**
 * Get the Redis subscriber client (singleton).
 * Creates the client on first call.
 *
 * Note: Subscriber client is separate from publisher because Redis pub/sub
 * mode blocks the connection from executing other commands.
 */
export function getSubscriber(): Redis {
  if (!subscriberClient) {
    subscriberClient = createRedisClient("subscriber");
  }
  return subscriberClient;
}

/**
 * Gracefully shutdown all Redis connections.
 * Should be called when the server is shutting down.
 */
export async function shutdownRedis(): Promise<void> {
  console.info("[Redis] Shutting down connections...");

  const shutdownPromises: Promise<unknown>[] = [];

  if (publisherClient) {
    shutdownPromises.push(
      publisherClient.quit().catch((err: Error) => {
        console.error("[Redis publisher] Error during shutdown:", err);
      })
    );
  }

  if (subscriberClient) {
    shutdownPromises.push(
      subscriberClient.quit().catch((err: Error) => {
        console.error("[Redis subscriber] Error during shutdown:", err);
      })
    );
  }

  await Promise.all(shutdownPromises);
  console.info("[Redis] All connections closed");
}

/**
 * Check if Redis is connected and ready.
 * Returns true if both publisher and subscriber are connected.
 */
export function isRedisConnected(): boolean {
  const publisherReady = publisherClient?.status === "ready";
  const subscriberReady = subscriberClient?.status === "ready";
  return publisherReady && subscriberReady;
}

/**
 * Check if Redis subscriber is connected.
 * Used to determine if SSE streaming is available.
 */
export function isSubscriberConnected(): boolean {
  return (
    subscriberClient?.status === "ready" ||
    subscriberClient?.status === "connect"
  );
}
