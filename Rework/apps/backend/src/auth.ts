import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Auth is opt-in via AUTH_ENABLED, so the local/desktop mode (single user,
// no login concept in the legacy app either) keeps working exactly as
// before. Central hosting turns this on to protect writes while leaving
// GET routes public (the "Web-Ansicht für Mannschaften/Zuschauer"
// requirement - spectators can view results without an account).
export const authEnabled = process.env.AUTH_ENABLED === "true";

export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? "dev-secret-change-me-in-production",
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!authEnabled) return;
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Anmeldung erforderlich." });
  }
}
