import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";
import { sendMail } from "../mail.js";

type CreateUserBody = { email: string; realName: string };

function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

// Mirrors view/UserAdministration.java's account-creation flow: a new
// webservice user is created with a generated password and notified by
// mail (tools/SendMail.java), instead of an admin having to communicate
// credentials out of band.
export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/users", { preHandler: requireAuth }, async () => {
    return prisma.user.findMany({ select: { id: true, email: true, realName: true }, orderBy: { realName: "asc" } });
  });

  app.post<{ Body: CreateUserBody }>("/users", { preHandler: requireAuth }, async (request, reply) => {
    const { email, realName } = request.body;
    if (!email || !realName) {
      reply.code(400);
      return { error: "E-Mail und Name sind erforderlich." };
    }

    const temporaryPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(temporaryPassword, 10);

    let user;
    try {
      user = await prisma.user.create({ data: { email, realName, password: hash, salt: "" } });
    } catch {
      reply.code(409);
      return { error: "Diese E-Mail-Adresse ist bereits registriert." };
    }

    await sendMail(
      email,
      "Zugang SchützenManager",
      `Hallo ${realName},\n\ndein Account für den SchützenManager wurde angelegt.\n\nE-Mail: ${email}\nPasswort: ${temporaryPassword}\n\nBitte melde dich an und ändere dein Passwort.\n\nMit freundlichen Grüßen`,
    );

    reply.code(201);
    return { id: user.id, email: user.email, realName: user.realName };
  });

  // Mirrors UserAdministration.java's row context menu "Löschen".
  app.delete<{ Params: { id: string } }>("/users/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = Number(request.params.id);
    try {
      await prisma.user.delete({ where: { id } });
    } catch {
      reply.code(404);
      return { error: "Benutzer nicht gefunden." };
    }
    reply.code(204);
    return null;
  });

  // Mirrors UserAdministration.java's "Passwort zurücksetzen": generate a
  // fresh temporary password, store its hash, and mail it to the user.
  app.post<{ Params: { id: string } }>("/users/:id/reset-password", { preHandler: requireAuth }, async (request, reply) => {
    const id = Number(request.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      reply.code(404);
      return { error: "Benutzer nicht gefunden." };
    }
    const temporaryPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(temporaryPassword, 10);
    await prisma.user.update({ where: { id }, data: { password: hash } });

    await sendMail(
      user.email,
      "Neues Passwort SchützenManager",
      `Hallo ${user.realName},\n\ndein Passwort für den SchützenManager wurde zurückgesetzt.\n\nE-Mail: ${user.email}\nPasswort: ${temporaryPassword}\n\nBitte melde dich an und ändere dein Passwort.\n\nMit freundlichen Grüßen`,
    );

    return { ok: true };
  });
};
