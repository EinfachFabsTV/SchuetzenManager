import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

// Mirrors view/ResponsibleView.java + the remote `responsible` table:
// assigns webservice users as "responsible" for individual teams within a
// season (so a club contact can enter only their own team's results on the
// central-hosting web view). The Responsible model stores the team by name
// and the season by id, matching the legacy remote schema.
export const responsibleRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>("/seasons/:id/responsible", { preHandler: requireAuth }, async (request) => {
    const seasonId = Number(request.params.id);
    const rows = await prisma.responsible.findMany({
      where: { season: seasonId },
      include: { user: { select: { email: true, realName: true } } },
    });
    return rows.map((r) => ({ id: r.id, userId: r.userId, team: r.team, email: r.user.email, realName: r.user.realName }));
  });

  app.post<{ Params: { id: string }; Body: { userId: number; team: string } }>(
    "/seasons/:id/responsible",
    { preHandler: requireAuth },
    async (request, reply) => {
      const seasonId = Number(request.params.id);
      const { userId, team } = request.body;
      if (!userId || !team) {
        reply.code(400);
        return { error: "Benutzer und Mannschaft sind erforderlich." };
      }
      const existing = await prisma.responsible.findFirst({ where: { season: seasonId, userId, team } });
      if (existing) {
        reply.code(409);
        return { error: "Der Benutzer ist dieser Mannschaft bereits zugeordnet." };
      }
      const created = await prisma.responsible.create({ data: { season: seasonId, userId, team } });
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, realName: true } });
      reply.code(201);
      return { id: created.id, userId, team, email: user?.email ?? "", realName: user?.realName ?? "" };
    },
  );

  app.delete<{ Params: { id: string } }>("/responsible/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = Number(request.params.id);
    try {
      await prisma.responsible.delete({ where: { id } });
    } catch {
      reply.code(404);
      return { error: "Zuordnung nicht gefunden." };
    }
    reply.code(204);
    return null;
  });
};
