import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";
import {
  createError,
  ErrorCode,
  getStatusForErrorCode,
} from "../../lib/errors.js";
import {
  StationParamsSchema,
  PaginationQuerySchema,
  type PaginatedResponse,
} from "../../lib/validation.js";
import type { Station } from "@prisma/client";

const plugin: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: { page?: string; limit?: string };
  }>("/", async (req, reply) => {
    const parseResult = PaginationQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      const error = createError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid pagination parameters",
        parseResult.error.format()
      );
      return reply
        .code(getStatusForErrorCode(ErrorCode.VALIDATION_ERROR))
        .send(error);
    }

    const { page, limit } = parseResult.data;
    const skip = (page - 1) * limit;

    const [stations, total] = await Promise.all([
      prisma.station.findMany({
        where: { isActive: true },
        skip,
        take: limit,
      }),
      prisma.station.count({ where: { isActive: true } }),
    ]);

    const response: PaginatedResponse<Station> = {
      data: stations,
      meta: {
        page,
        limit,
        total,
      },
    };

    return response;
  });

  app.get("/:id", (req, reply) => {
    const parseResult = StationParamsSchema.safeParse(req.params);

    if (!parseResult.success) {
      const error = createError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid station ID",
        parseResult.error.format()
      );
      return reply
        .code(getStatusForErrorCode(ErrorCode.VALIDATION_ERROR))
        .send(error);
    }

    const { id } = parseResult.data;
    return prisma.station.findUnique({ where: { id } }).then((station) => {
      if (!station) {
        const error = createError(ErrorCode.NOT_FOUND, "Station not found");
        return reply
          .code(getStatusForErrorCode(ErrorCode.NOT_FOUND))
          .send(error);
      }
      return station;
    });
  });
};

export default plugin;
