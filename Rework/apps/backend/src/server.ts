import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { seasonsRoutes } from "./routes/seasons.js";
import { matchesRoutes } from "./routes/matches.js";
import { teamsRoutes } from "./routes/teams.js";
import { authRoutes } from "./routes/auth.js";
import { registerAuth } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

await registerAuth(app);
await app.register(authRoutes, { prefix: "/api" });
await app.register(seasonsRoutes, { prefix: "/api" });
await app.register(matchesRoutes, { prefix: "/api" });
await app.register(teamsRoutes, { prefix: "/api" });

// In the Docker image, the built frontend (Rework/apps/frontend/dist) is
// copied next to this file's compiled output as ./public - see Dockerfile.
// In local dev, that folder doesn't exist and Vite serves the frontend
// separately (see vite.config.ts's /api proxy), so this is skipped.
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  await app.register(fastifyStatic, { root: publicDir });
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.method === "GET" && !request.url.startsWith("/api")) {
      reply.sendFile("index.html");
    } else {
      reply.code(404).send({ error: "Not found" });
    }
  });
}

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
