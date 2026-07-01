import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";
import { isAgeGroup } from "../domain/ageGroup.js";

type ShootInput = {
  firstName: string;
  lastName: string;
  ageGroup: string;
  startId?: number | null;
  endId?: number | null;
  result: number;
};

type SaveMatchBody = {
  homeShoots: ShootInput[];
  guestShoots: ShootInput[];
  additionalHomeShoots?: ShootInput[];
  additionalGuestShoots?: ShootInput[];
};

function validateShoots(shoots: ShootInput[] | undefined): string | null {
  for (const s of shoots ?? []) {
    if (!isAgeGroup(s.ageGroup)) return `Unbekannte Altersklasse: ${s.ageGroup}`;
  }
  return null;
}

export const matchesRoutes: FastifyPluginAsync = async (app) => {
  // Mirrors Database.java#updateMatch(): replaces all shoot rows for the
  // match. Primary shoots need both first and last name to be persisted;
  // additional/substitute shoots only need a first name (matches the
  // legacy asymmetric check in updateMatch()).
  app.put<{ Params: { id: string }; Body: SaveMatchBody }>("/matches/:id", async (request, reply) => {
    const matchId = Number(request.params.id);
    const { homeShoots, guestShoots, additionalHomeShoots, additionalGuestShoots } = request.body;

    for (const shoots of [homeShoots, guestShoots, additionalHomeShoots, additionalGuestShoots]) {
      const error = validateShoots(shoots);
      if (error) {
        reply.code(400);
        return { error };
      }
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      reply.code(404);
      return { error: "Match nicht gefunden." };
    }

    const rows: {
      matchId: number;
      firstName: string;
      lastName: string;
      ageGroup: string;
      teamSide: string;
      additional: boolean;
      startId: number | null;
      endId: number | null;
      result: number;
    }[] = [];

    const addPrimary = (shoots: ShootInput[] | undefined, teamSide: "HOME" | "GUEST") => {
      for (const s of shoots ?? []) {
        if (s.firstName.trim().length === 0 || s.lastName.trim().length === 0) continue;
        rows.push({
          matchId,
          firstName: s.firstName,
          lastName: s.lastName,
          ageGroup: s.ageGroup,
          teamSide,
          additional: false,
          startId: s.startId ?? null,
          endId: s.endId ?? null,
          result: s.result,
        });
      }
    };
    const addAdditional = (shoots: ShootInput[] | undefined, teamSide: "HOME" | "GUEST") => {
      for (const s of shoots ?? []) {
        if (s.firstName.trim().length === 0) continue;
        rows.push({
          matchId,
          firstName: s.firstName,
          lastName: s.lastName,
          ageGroup: s.ageGroup,
          teamSide,
          additional: true,
          startId: s.startId ?? null,
          endId: s.endId ?? null,
          result: s.result,
        });
      }
    };

    addPrimary(homeShoots, "HOME");
    addPrimary(guestShoots, "GUEST");
    addAdditional(additionalHomeShoots, "HOME");
    addAdditional(additionalGuestShoots, "GUEST");

    await prisma.$transaction([
      prisma.shoot.deleteMany({ where: { matchId } }),
      ...(rows.length > 0 ? [prisma.shoot.createMany({ data: rows })] : []),
    ]);

    return prisma.match.findUnique({
      where: { id: matchId },
      include: { shoots: true, homeTeam: true, guestTeam: true },
    });
  });
};
