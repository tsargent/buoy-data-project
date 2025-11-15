import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.get("/by-station/:stationId", async (req) => {
    const { stationId } = req.params as { stationId: string };
    const { limit = "100", since } = req.query as {
      limit?: string;
      since?: string;
    };
    const where = {
      stationId,
      ...(since ? { observedAt: { gt: new Date(since) } } : {}),
    };
    const rows = await prisma.observation.findMany({
      where,
      orderBy: { observedAt: "desc" },
      take: Number(limit),
    });
    return rows.reverse();
  });
};

export default plugin;
