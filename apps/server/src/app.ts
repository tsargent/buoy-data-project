import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { env } from "./env.js";
import stations from "./routes/stations.js";
import observations from "./routes/observations.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(stations, { prefix: "/stations" });
  await app.register(observations, { prefix: "/observations" });

  return app;
}
