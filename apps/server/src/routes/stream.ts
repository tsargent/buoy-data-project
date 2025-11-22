import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { connectionManager } from "../../lib/sse-manager.js";
import { logger } from "../../lib/logger.js";

// SSE Stream Route (Task 2.1 / 2.2 - initial implementation)
// Provides /v1/observations/stream endpoint returning Server-Sent Events.
// Sends initial `connection` event; observation broadcasts will be added later.
export default fp(async function streamRoute(app: FastifyInstance) {
  app.get("/v1/observations/stream", async (request, reply) => {
    // Set SSE headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering if present

    // Register client before sending initial event
    connectionManager.addClient(reply as any);

    // Initial connection event
    try {
      reply.raw.write(
        `event: connection\n` + `data: ${JSON.stringify({ status: "ok" })}\n\n`
      );
    } catch (err) {
      logger.warn(
        { event: "sse_connection_error", error: (err as Error).message },
        "Failed to write initial connection event"
      );
    }

    // Handle client disconnect
    const onClose = () => {
      connectionManager.removeClient(reply as any);
      request.raw.removeListener("close", onClose);
    };
    request.raw.on("close", onClose);

    // Keep the connection open
    return reply; // fastify keeps it open since we don't end the response
  });
});
