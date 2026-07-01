import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

app.get("/seasons", async () => {
  return prisma.season.findMany({
    orderBy: [{ year: "desc" }, { label: "asc" }],
  });
});

app.post<{ Body: { year: number; label: string } }>("/seasons", async (request, reply) => {
  const { year, label } = request.body;
  const season = await prisma.season.create({ data: { year, label } });
  reply.code(201);
  return season;
});

const port = Number(process.env.PORT ?? 3001);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
