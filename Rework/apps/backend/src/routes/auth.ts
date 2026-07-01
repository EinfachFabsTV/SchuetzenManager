import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { authEnabled } from "../auth.js";

type Credentials = { email: string; password: string };
type RegisterBody = Credentials & { realName: string };

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/auth/status", async () => ({ enabled: authEnabled }));

  // Bootstrap: only works while no user exists yet, so there's no
  // chicken-and-egg problem creating the first admin account on a fresh
  // central deployment. Once a user exists, use an authenticated user
  // management endpoint instead (not yet built - see TECHNICAL.md).
  app.post<{ Body: RegisterBody }>("/auth/register", async (request, reply) => {
    const existing = await prisma.user.count();
    if (existing > 0) {
      reply.code(403);
      return { error: "Registrierung ist nur für den ersten Account möglich." };
    }
    const { email, password, realName } = request.body;
    if (!email || !password || !realName) {
      reply.code(400);
      return { error: "E-Mail, Name und Passwort sind erforderlich." };
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, realName, password: hash, salt: "" } });
    const token = app.jwt.sign({ sub: user.id, email: user.email });
    reply.code(201);
    return { token, user: { id: user.id, email: user.email, realName: user.realName } };
  });

  app.post<{ Body: Credentials }>("/auth/login", async (request, reply) => {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      reply.code(401);
      return { error: "E-Mail oder Passwort ist falsch." };
    }
    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return { token, user: { id: user.id, email: user.email, realName: user.realName } };
  });

  app.get("/auth/me", { preHandler: [(req, reply) => req.jwtVerify().catch(() => reply.code(401).send({ error: "Nicht angemeldet." }))] }, async (request) => {
    const payload = request.user as { sub: number; email: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    return user ? { id: user.id, email: user.email, realName: user.realName } : null;
  });
};
