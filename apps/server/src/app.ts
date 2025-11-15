import Fastify from "fastify";
import type { FastifyError } from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { env } from "./env.js";
import stations from "./routes/stations.js";
import observations from "./routes/observations.js";
import { createError, ErrorCode, type ErrorResponse } from "../lib/errors.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    // Generate reqId for request tracing
    genReqId: () => crypto.randomUUID(),
  });
  await app.register(cors, { origin: true });
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  // Global error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);

    // Handle Prisma errors (check constructor name since Prisma types not directly importable)
    const errorName = error.constructor.name;
    if (errorName === "PrismaClientKnownRequestError") {
      const errorResponse = createError(
        ErrorCode.INTERNAL_ERROR,
        "Database error occurred"
      );
      return reply.code(500).send(errorResponse);
    }

    if (errorName === "PrismaClientValidationError") {
      const errorResponse = createError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid data provided"
      );
      return reply.code(400).send(errorResponse);
    }

    // Handle validation errors from Fastify
    if (error.validation) {
      const errorResponse = createError(
        ErrorCode.VALIDATION_ERROR,
        error.message,
        error.validation
      );
      return reply.code(400).send(errorResponse);
    }

    // Default error response
    const errorResponse: ErrorResponse = createError(
      ErrorCode.INTERNAL_ERROR,
      error.message || "An unexpected error occurred"
    );

    return reply.code(error.statusCode || 500).send(errorResponse);
  });

  app.get("/health", () => ({ status: "ok" }));
  await app.register(stations, { prefix: "/stations" });
  await app.register(observations, { prefix: "/observations" });

  return app;
}
