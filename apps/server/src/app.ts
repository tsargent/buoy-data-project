import Fastify from "fastify";
import type { FastifyError } from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { env } from "./env.js";
import stations from "./routes/stations.js";
import observations from "./routes/observations.js";
import { createError, ErrorCode, type ErrorResponse } from "../lib/errors.js";
import {
  register,
  httpRequestCounter,
  httpRequestDuration,
} from "../lib/metrics.js";
import "./types.js"; // Augment FastifyRequest

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: "info",
      // Redact sensitive data from logs
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers['x-api-key']",
        ],
        remove: true,
      },
    },
    // Generate reqId for request tracing
    genReqId: () => crypto.randomUUID(),
  });

  // Security headers
  await app.register(helmet, {
    // Allow inline scripts for development (disable in production)
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    // Required for /metrics endpoint
    crossOriginEmbedderPolicy: false,
  });

  // CORS configuration
  // TODO: In production, restrict origins to specific domains
  await app.register(cors, {
    origin: process.env.NODE_ENV === "production" ? false : true,
    credentials: true,
  });

  // JWT configuration with production check
  const jwtSecret = env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && jwtSecret === "dev-secret") {
    throw new Error(
      "SECURITY: Cannot use default JWT_SECRET in production. Set a secure value in environment variables."
    );
  }
  await app.register(fastifyJwt, { secret: jwtSecret });

  // Rate limiting: global default + per-route overrides
  await app.register(rateLimit, {
    global: true,
    max: 100, // 100 requests per minute (default)
    timeWindow: "1 minute",
    addHeadersOnExceeding: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  });

  // Static file serving for web-demo
  // Serve files from ../web-demo/dist directory
  const staticRoot = join(__dirname, "..", "..", "web-demo", "dist");
  await app.register(fastifyStatic, {
    root: staticRoot,
    prefix: "/", // Serve at root path
  });

  // Metrics middleware - track request count and duration
  app.addHook("onRequest", async (request) => {
    request.requestStartTime = Date.now();
  });

  app.addHook("onResponse", async (request, reply) => {
    const duration =
      (Date.now() - (request.requestStartTime || Date.now())) / 1000;
    const route = request.routeOptions.url || request.url;
    const method = request.method;
    const statusCode = reply.statusCode.toString();

    httpRequestCounter.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe(
      { method, route, status_code: statusCode },
      duration
    );
  });

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

  // Metrics endpoint (no versioning)
  app.get("/metrics", async () => register.metrics());

  // Health check (no versioning)
  app.get("/health", () => ({ status: "ok" }));

  // API v1 routes
  await app.register(stations, { prefix: "/v1/stations" });
  await app.register(observations, { prefix: "/v1/observations" });

  // SPA routing fallback - serve index.html for non-API routes that aren't files
  app.setNotFoundHandler(async (request, reply) => {
    // If the route starts with /v1/, /metrics, or /health, it's an API route - return 404
    if (
      request.url.startsWith("/v1/") ||
      request.url.startsWith("/metrics") ||
      request.url.startsWith("/health")
    ) {
      return reply.code(404).send({
        error: "NOT_FOUND",
        message: `Route ${request.method}:${request.url} not found`,
        statusCode: 404,
      });
    }

    // Otherwise, serve index.html for SPA routing
    return reply.sendFile("index.html");
  });

  return app;
}
