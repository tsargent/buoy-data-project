import type { FastifyReply } from "fastify";
import { logger } from "./logger.js";

/**
 * ConnectionManager tracks active SSE client connections and provides
 * broadcast capabilities. Implemented per Task 1.2 acceptance criteria.
 */
class ConnectionManager {
  private connections: Set<FastifyReply> = new Set();
  private connectedAt: Map<FastifyReply, number> = new Map();

  addClient(reply: FastifyReply): void {
    this.connections.add(reply);
    this.connectedAt.set(reply, Date.now());
    logger.debug(
      {
        event: "sse_client_added",
        connectionCount: this.getConnectionCount(),
      },
      "SSE client added"
    );
  }

  removeClient(reply: FastifyReply): void {
    if (!this.connections.has(reply)) return;
    this.connections.delete(reply);
    const start = this.connectedAt.get(reply) || Date.now();
    this.connectedAt.delete(reply);
    const durationMs = Date.now() - start;
    logger.debug(
      {
        event: "sse_client_removed",
        connectionCount: this.getConnectionCount(),
        durationMs,
      },
      "SSE client removed"
    );
  }

  /**
   * Broadcast an SSE event to all active clients.
   * Returns number of successful writes.
   */
  broadcastToAll(eventType: string, data: unknown): number {
    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    let success = 0;
    for (const reply of [...this.connections]) {
      try {
        // Write directly to raw socket; FastifyReply.raw is a ServerResponse
        reply.raw.write(payload);
        success++;
      } catch (err) {
        logger.warn(
          {
            event: "sse_write_failed",
            error: err instanceof Error ? err.message : String(err),
          },
          "Failed to write SSE event to client; removing connection"
        );
        this.removeClient(reply);
      }
    }
    logger.debug(
      {
        event: "sse_broadcast",
        eventType,
        clientCount: this.getConnectionCount(),
        successCount: success,
      },
      "Broadcast complete"
    );
    return success;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}

export const connectionManager = new ConnectionManager();
