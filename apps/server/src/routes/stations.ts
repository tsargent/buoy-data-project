import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";
import {
  createError,
  ErrorCode,
  getStatusForErrorCode,
} from "../../lib/errors.js";
import { StationParamsSchema } from "../../lib/validation.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.get("/", () => prisma.station.findMany({ where: { isActive: true } }));

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
