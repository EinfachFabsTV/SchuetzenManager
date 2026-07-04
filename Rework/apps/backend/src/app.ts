import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import { seasonsRoutes } from "./routes/seasons.js";
import { matchesRoutes } from "./routes/matches.js";
import { teamsRoutes } from "./routes/teams.js";
import { authRoutes } from "./routes/auth.js";
import { usersRoutes } from "./routes/users.js";
import { responsibleRoutes } from "./routes/responsible.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Split out from server.ts so tests can build a Fastify instance (and
// exercise it via .inject()) without also binding a real network port.
export async function buildApp(options?: { logger?: boolean }) {
  const app = Fastify({ logger: options?.logger ?? true });

  // Needed for the desktop app: the Tauri webview runs at its own origin
  // (e.g. http://tauri.localhost) and calls this sidecar backend
  // cross-origin at http://localhost:3001, which triggers a CORS preflight
  // on any non-simple request (POST/PUT/DELETE, or anything with a
  // Content-Type/Authorization header). Without this, writes fail in the
  // desktop app with a bare "Failed to fetch" while GETs still work. Dev
  // (Vite proxy) and central hosting (same-origin) don't hit CORS at all,
  // so reflecting the origin is safe here - the sidecar is only reachable
  // from the local machine anyway.
  await app.register(fastifyCors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, { prefix: "/api" });
  await app.register(usersRoutes, { prefix: "/api" });
  await app.register(seasonsRoutes, { prefix: "/api" });
  await app.register(matchesRoutes, { prefix: "/api" });
  await app.register(teamsRoutes, { prefix: "/api" });
  await app.register(responsibleRoutes, { prefix: "/api" });

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
