import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import Fastify, { type FastifyError } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import { seasonsRoutes } from "./routes/seasons.js";
import { matchesRoutes } from "./routes/matches.js";
import { teamsRoutes } from "./routes/teams.js";
import { authRoutes } from "./routes/auth.js";
import { usersRoutes } from "./routes/users.js";
import { responsibleRoutes } from "./routes/responsible.js";
import { settingsRoutes } from "./routes/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Split out from server.ts so tests can build a Fastify instance (and
// exercise it via .inject()) without also binding a real network port.
export async function buildApp(options?: { logger?: boolean }) {
  // Raised from Fastify's 1 MB default so a legitimate logo upload fits: the
  // logo is sent as base64 JSON (~33% larger), so a 1 MB image is ~1.33 MB on
  // the wire. The real per-logo cap (1 MB decoded) is enforced in
  // routes/settings.ts; this just keeps the transport from rejecting it first.
  const app = Fastify({ logger: options?.logger ?? true, bodyLimit: 3 * 1024 * 1024 });

  // Needed for the desktop app: the Tauri webview runs at its own origin
  // (e.g. http://tauri.localhost) and calls this sidecar backend
  // cross-origin at http://localhost:3001, which triggers a CORS preflight
  // on any non-simple request (POST/PUT/DELETE, or anything with a
  // Content-Type/Authorization header). Without this, writes fail in the
  // desktop app with a bare "Failed to fetch" while GETs still work. Dev
  // (Vite proxy) and central hosting (same-origin) don't hit CORS at all,
  // so reflecting the origin is safe here - the sidecar is only reachable
  // from the local machine anyway.
  // origin: true reflects the caller's origin (fine - localhost-only
  // sidecar). methods MUST be listed explicitly: @fastify/cors defaults to
  // only GET,HEAD,POST, so a PUT/PATCH/DELETE preflight would be rejected
  // by the browser ("Failed to fetch") even though the route exists - which
  // broke every edit/delete in the desktop app while POST (create) worked.
  await app.register(fastifyCors, {
    origin: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Turn unhandled exceptions into a readable German { error } payload
  // instead of Fastify's bare "Internal Server Error". Known cases in the
  // routes already reply with reply.code(...) + { error: "..." }; this is
  // the safety net for the unexpected rest, so the frontend (which reads
  // body.error) always has something meaningful to show on a failed save.
  //
  // The message is deliberately DETAILED: this runs as a local sidecar for a
  // single desktop user, not a public multi-tenant server, so hiding the
  // cause only makes bug reports useless. The user gets what actually went
  // wrong plus which request caused it, so it can be pasted straight into a
  // report via the "Fehler melden" link. Stack traces stay in the log.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error(error);
    const status = typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;

    if (status < 500) {
      reply.code(status).send({ error: error.message || "Ungültige Anfrage." });
      return;
    }

    // Prisma surfaces its own codes (P2002 unique violation, P2025 not found,
    // ...) which are the single most useful clue when something breaks.
    const code = (error as { code?: string }).code;
    // Prisma prefixes its messages with a multi-line source excerpt of the
    // failing call. That's noise for a club user - keep the last meaningful
    // line (the actual cause) and drop the code listing.
    const lines = (error.message || String(error))
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^\d+\s|^→|^Invalid `|^\{|^\}/.test(l));
    const cause = lines[lines.length - 1] || "Unbekannte Ursache";
    const details = [cause, code ? `Code: ${code}` : null, `${request.method} ${request.url}`].filter(Boolean).join(" · ");
    reply.code(status).send({
      error: `Unerwarteter Fehler: ${details}. Bitte melde diesen Text über „Fehler melden“, wenn er erneut auftritt.`,
    });
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(authRoutes, { prefix: "/api" });
  await app.register(usersRoutes, { prefix: "/api" });
  await app.register(seasonsRoutes, { prefix: "/api" });
  await app.register(matchesRoutes, { prefix: "/api" });
  await app.register(teamsRoutes, { prefix: "/api" });
  await app.register(responsibleRoutes, { prefix: "/api" });
  await app.register(settingsRoutes, { prefix: "/api" });

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
