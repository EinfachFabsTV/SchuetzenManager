import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

type UpdateTeamBody = {
  name: string;
  trainingDay?: string | null;
  trainingTime?: string | null;
  location?: string | null;
  contact?: string | null;
  phone?: string | null;
};

// Mirrors view/EditTeam.java#save()/Database.java#updateTeam(). Unlike the
// legacy app, renaming here is a plain attribute update - matches/shoots
// reference the team by surrogate id, not by name, so there is no cascade
// to replay across tables.
export const teamsRoutes: FastifyPluginAsync = async (app) => {
  app.put<{ Params: { id: string }; Body: UpdateTeamBody }>("/teams/:id", { preHandler: requireAuth }, async (request, reply) => {
    const id = Number(request.params.id);
    const { name, trainingDay, trainingTime, location, contact, phone } = request.body;

    if (!name || name.trim().length === 0) {
      reply.code(400);
      return { error: "Es muss ein Mannschaftsname gewählt werden." };
    }

    try {
      return await prisma.team.update({
        where: { id },
        data: {
          name,
          trainingDay: trainingDay ?? null,
          trainingTime: trainingTime ?? null,
          location: location ?? null,
          contact: contact ?? null,
          phone: phone ?? null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        reply.code(409);
        return { error: "Der Mannschaftsname ist bereits belegt." };
      }
      throw err;
    }
  });
};
