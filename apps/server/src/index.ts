import { buildApp } from "./app.js";
import { env } from "./env.js";
import { shutdownRedis } from "../lib/redis.js";
import {
  initializeSubscriber,
  shutdownSubscriber,
} from "../lib/redis-subscriber.js";

const app = await buildApp();

// Initialize Redis subscriber for SSE streaming
try {
  await initializeSubscriber();
  console.log("Redis subscriber initialized");
} catch (error) {
  console.error("Failed to initialize Redis subscriber:", error);
  console.warn(
    "SSE streaming will not be available until Redis connection is established"
  );
}

await app.listen({ port: env.PORT, host: "0.0.0.0" });
console.log(`API on :${env.PORT}`);

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  try {
    // Close Fastify server
    await app.close();
    console.log("Fastify server closed");

    // Unsubscribe from Redis channels
    await shutdownSubscriber();

    // Close Redis connections
    await shutdownRedis();

    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
