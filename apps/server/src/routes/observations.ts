import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";
import {
  createError,
  ErrorCode,
  getStatusForErrorCode,
} from "../../lib/errors.js";
import {
  ObservationQuerySchema,
  ObservationParamsSchema,
  type PaginatedResponse,
} from "../../lib/validation.js";
import { observationsQueriedCounter } from "../../lib/metrics.js";
import type { Observation } from "@prisma/client";
import { connectionManager } from "../../lib/sse-manager.js";
import { isSubscriberConnected } from "../../lib/redis.js";
import { getLoopLatencySamples } from "../../lib/redis-subscriber.js";

const plugin: FastifyPluginAsync = async (app) => {
  /**
   * SSE Stream endpoint - Real-time observation events
   *
   * GET /stream
   *
   * Establishes a Server-Sent Events connection and streams real-time observation
   * events as they are published by the worker.
   *
   * Returns:
   * - 200: SSE connection established (sends connection event immediately)
   * - 500: Service unavailable (Redis not connected)
   */
  app.get("/stream", async (request, reply) => {
    // Check if Redis subscriber is connected
    if (!isSubscriberConnected()) {
      const error = createError(
        ErrorCode.SERVICE_UNAVAILABLE,
        "Real-time streaming is temporarily unavailable. Please try again later."
      );
      return reply
        .code(getStatusForErrorCode(ErrorCode.SERVICE_UNAVAILABLE))
        .send(error);
    }

    // Set SSE response headers (including CORS)
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
      "Access-Control-Allow-Origin": request.headers.origin || "*",
      "Access-Control-Allow-Credentials": "true",
    });

    // Add client to connection manager
    connectionManager.addClient(reply);

    // Send connection confirmation event
    const connectionEvent = {
      status: "connected",
      timestamp: new Date().toISOString(),
    };
    reply.raw.write(
      `event: connection\ndata: ${JSON.stringify(connectionEvent)}\n\n`
    );

    request.log.info(
      {
        connectionCount: connectionManager.getConnectionCount(),
        requestId: request.id,
      },
      "SSE client connected"
    );

    // Handle client disconnection
    request.raw.on("close", () => {
      const duration = connectionManager.getConnectionDuration(reply);
      connectionManager.removeClient(reply);

      request.log.info(
        {
          connectionDuration: Math.round(duration / 1000),
          connectionCount: connectionManager.getConnectionCount(),
          requestId: request.id,
        },
        "SSE client disconnected"
      );
    });

    // Handle connection errors
    request.raw.on("error", (err: Error) => {
      request.log.error(
        {
          error: err.message,
          requestId: request.id,
        },
        "SSE connection error"
      );
      connectionManager.removeClient(reply);
    });

    // Keep connection open (don't call reply.send())
  });

  // Debug endpoint: loop latency samples (development only)
  app.get("/v1/debug/sse-loop-latencies", async (request, reply) => {
    if (process.env.NODE_ENV === "production") {
      return reply
        .code(404)
        .send({
          error: {
            code: "INVALID_REQUEST",
            message: "Not available in production",
          },
        });
    }
    const samples = getLoopLatencySamples();
    return { samples, count: samples.length };
  });

  app.get<{
    Params: { stationId: string };
    Querystring: { page?: string; limit?: string; since?: string };
  }>(
    "/by-station/:stationId",
    {
      config: {
        rateLimit: {
          max: 60, // 60 requests per minute for observations endpoint
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      // Validate params
      const paramsResult = ObservationParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        const error = createError(
          ErrorCode.VALIDATION_ERROR,
          "Invalid station ID",
          paramsResult.error.format()
        );
        return reply
          .code(getStatusForErrorCode(ErrorCode.VALIDATION_ERROR))
          .send(error);
      }

      // Validate query
      const queryResult = ObservationQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        const error = createError(
          ErrorCode.VALIDATION_ERROR,
          "Invalid query parameters",
          queryResult.error.format()
        );
        return reply
          .code(getStatusForErrorCode(ErrorCode.VALIDATION_ERROR))
          .send(error);
      }

      const { stationId } = paramsResult.data;
      const { page, limit, since } = queryResult.data;
      const skip = (page - 1) * limit;

      // Log business context
      req.log.info(
        { stationId, page, limit, since },
        "Fetching station observations"
      );

      const where = {
        stationId,
        ...(since ? { observedAt: { gt: new Date(since) } } : {}),
      };

      const [observations, total] = await Promise.all([
        prisma.observation.findMany({
          where,
          orderBy: { observedAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.observation.count({ where }),
      ]);

      req.log.info(
        { stationId, count: observations.length, total },
        "Observations retrieved"
      );

      // Track domain metric
      observationsQueriedCounter.inc(
        { station_id: stationId },
        observations.length
      );

      const response: PaginatedResponse<Observation> = {
        data: observations.reverse(),
        meta: {
          page,
          limit,
          total,
        },
      };

      return response;
    }
  );
};

export default plugin;
