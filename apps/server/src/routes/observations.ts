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

const plugin: FastifyPluginAsync = async (app) => {
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
