import Fastify from "fastify";
import { seasonsRoutes } from "./routes/seasons.js";
import { matchesRoutes } from "./routes/matches.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

await app.register(seasonsRoutes);
await app.register(matchesRoutes);

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
