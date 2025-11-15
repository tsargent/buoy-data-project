import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../../lib/prisma.js";

const plugin: FastifyPluginAsync = async (app) => {
  app.get("/", async () =>
    prisma.station.findMany({ where: { isActive: true } }),
  );
  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const station = await prisma.station.findUnique({ where: { id } });
    if (!station) return reply.code(404).send({ message: "Not found" });
    return station;
  });
};

export default plugin;
