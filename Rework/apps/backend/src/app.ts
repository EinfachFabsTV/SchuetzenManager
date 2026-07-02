import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { seasonsRoutes } from "./routes/seasons.js";
import { matchesRoutes } from "./routes/matches.js";
import { teamsRoutes } from "./routes/teams.js";
import { authRoutes } from "./routes/auth.js";
import { usersRoutes } from "./routes/users.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Split out from server.ts so tests can build a Fastify instance (and
// exercise it via .inject()) without also binding a real network port.
export async function buildApp(options?: { logger?: boolean }) {
  const app = Fastify({ logger: options?.logger ?? true });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, { prefix: "/api" });
  await app.register(usersRoutes, { prefix: "/api" });
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

  return app;
}
