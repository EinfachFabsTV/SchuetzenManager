import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";

// Auth is opt-in via AUTH_ENABLED, so the local/desktop mode (single user,
// no login concept in the legacy app either) keeps working exactly as
// before. Central hosting turns this on to protect writes while leaving
// GET routes public (the "Web-Ansicht für Mannschaften/Zuschauer"
// requirement - spectators can view results without an account).
export const authEnabled = process.env.AUTH_ENABLED === "true";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me-in-production";

export type TokenPayload = { sub: number; email: string };

// Uses jsonwebtoken directly rather than @fastify/jwt: the Fastify-4-
// compatible @fastify/jwt@8 pulls in a fast-jwt version with several
// critical CVEs (JWT auth bypass via empty HMAC secret, iss-claim
// validation bugs, cache-key collisions) that only got patched in
// fast-jwt versions requiring @fastify/jwt@10, which in turn requires
// Fastify 5 (see the "Upgrade to Fastify 5" follow-up task).
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET);
}

function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
}

export function getAuthenticatedUser(request: FastifyRequest): TokenPayload | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    return verifyToken(header.slice("Bearer ".length));
  } catch {
    return null;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!authEnabled) return;
  if (!getAuthenticatedUser(request)) {
    reply.code(401).send({ error: "Anmeldung erforderlich." });
  }
}
