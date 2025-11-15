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
} from "../../lib/validation.js";
import { observationsQueriedCounter } from "../../lib/metrics.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.get("/by-station/:stationId", (req, reply) => {
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
    const { limit, since } = queryResult.data;

    // Log business context
    req.log.info({ stationId, limit, since }, "Fetching station observations");

    const where = {
      stationId,
      ...(since ? { observedAt: { gt: new Date(since) } } : {}),
    };

    return prisma.observation
      .findMany({
        where,
        orderBy: { observedAt: "desc" },
        take: limit,
      })
      .then((rows) => {
        req.log.info(
          { stationId, count: rows.length },
          "Observations retrieved"
        );
        // Track domain metric
        observationsQueriedCounter.inc({ station_id: stationId }, rows.length);
        return rows.reverse();
      });
  });
};

export default plugin;
