import type { FastifyReply } from "fastify";
import {
  sseConnectionsGauge,
  sseEventsSentCounter,
  sseConnectionDurationHistogram,
  sseBroadcastLatencyHistogram,
} from "./metrics.js";

/**
 * Connection Manager for Server-Sent Events (SSE).
 *
 * Manages active SSE client connections and broadcasts events to all connected clients.
 * Uses a fire-and-forget broadcast model - slow clients may miss events if their TCP
 * buffer fills up.
 */
export class ConnectionManager {
  private activeConnections: Set<FastifyReply> = new Set();
  private connectionTimestamps: Map<FastifyReply, Date> = new Map();
  private connectionCounter = 0;

  /**
   * Add a new SSE client connection to the manager.
   */
  addClient(reply: FastifyReply): void {
    this.activeConnections.add(reply);
    this.connectionTimestamps.set(reply, new Date());
    this.connectionCounter++;

    // Update metrics
    sseConnectionsGauge.inc();

    console.debug(
      `[SSE] Client connected. Total connections: ${this.getConnectionCount()}`
    );
  }

  /**
   * Remove an SSE client connection from the manager.
   * Records connection duration before removing.
   */
  removeClient(reply: FastifyReply): void {
    const startTime = this.connectionTimestamps.get(reply);
    const duration = startTime ? Date.now() - startTime.getTime() : 0;

    this.activeConnections.delete(reply);
    this.connectionTimestamps.delete(reply);

    // Update metrics
    sseConnectionsGauge.dec();
    if (duration > 0) {
      sseConnectionDurationHistogram.observe(duration / 1000); // Convert ms to seconds
    }

    console.debug(
      `[SSE] Client disconnected. Duration: ${Math.round(duration / 1000)}s. ` +
        `Remaining connections: ${this.getConnectionCount()}`
    );
  }

  /**
   * Broadcast an event to all connected SSE clients.
   *
   * @param eventType - The SSE event type (e.g., 'connection', 'observation')
   * @param data - The event data (will be JSON stringified)
   * @returns The number of clients that successfully received the event
   *
   * Uses fire-and-forget model: writes to all clients and handles errors by
   * removing dead connections. Slow clients may miss events if TCP buffer fills.
   */
  broadcastToAll(eventType: string, data: unknown): number {
    if (this.activeConnections.size === 0) {
      console.debug(`[SSE] No active connections to broadcast to`);
      return 0;
    }

    const startTime = Date.now();
    const message = this.formatSSEMessage(eventType, data);
    const deadConnections: FastifyReply[] = [];
    let successCount = 0;

    for (const reply of this.activeConnections) {
      try {
        // Write to the raw Node.js response stream
        const written = reply.raw.write(message);

        if (!written) {
          // Buffer is full - client is slow
          console.debug(
            `[SSE] Client TCP buffer full, may be experiencing backpressure`
          );
        }

        successCount++;
      } catch (error) {
        // Connection is dead or broken
        console.debug(
          `[SSE] Error writing to client, marking for removal:`,
          error
        );
        deadConnections.push(reply);
      }
    }

    // Clean up dead connections
    for (const deadConnection of deadConnections) {
      this.removeClient(deadConnection);
    }

    // Record metrics
    const latencyMs = Date.now() - startTime;
    sseEventsSentCounter.inc({ event_type: eventType }, successCount);
    sseBroadcastLatencyHistogram.observe(latencyMs);

    console.debug(
      `[SSE] Broadcast '${eventType}' event to ${successCount} clients ` +
        `(${deadConnections.length} dead connections removed, latency: ${latencyMs}ms)`
    );

    return successCount;
  }

  /**
   * Format a message in SSE format.
   *
   * SSE format:
   * event: <event-type>
   * data: <json-data>
   * <blank-line>
   */
  private formatSSEMessage(eventType: string, data: unknown): string {
    const jsonData = JSON.stringify(data);
    return `event: ${eventType}\ndata: ${jsonData}\n\n`;
  }

  /**
   * Get the current number of active connections.
   */
  getConnectionCount(): number {
    return this.activeConnections.size;
  }

  /**
   * Get the total number of connections ever established (for metrics).
   */
  getTotalConnectionCount(): number {
    return this.connectionCounter;
  }

  /**
   * Get connection duration for a specific client (in milliseconds).
   * Returns 0 if client is not found.
   */
  getConnectionDuration(reply: FastifyReply): number {
    const startTime = this.connectionTimestamps.get(reply);
    return startTime ? Date.now() - startTime.getTime() : 0;
  }
}

/**
 * Singleton instance of the connection manager.
 * Import this to manage SSE connections across the application.
 */
export const connectionManager = new ConnectionManager();
