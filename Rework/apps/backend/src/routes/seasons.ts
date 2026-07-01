import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";
import { generateSchedule } from "../domain/roundRobin.js";
import { computeTable } from "../domain/table.js";
import { computePersonalScores } from "../domain/personalScores.js";
import { generateSeasonPdf } from "../domain/pdf.js";
import { requireAuth } from "../auth.js";

type TeamInput = {
  name: string;
  trainingDay?: string | null;
  trainingTime?: string | null;
  location?: string | null;
  contact?: string | null;
  phone?: string | null;
};

export const seasonsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/seasons", async () => {
    return prisma.season.findMany({ orderBy: [{ year: "desc" }, { label: "asc" }] });
  });

  app.post<{ Body: { year: number; label: string; teams: TeamInput[] } }>(
    "/seasons",
    { preHandler: requireAuth },
    async (request, reply) => {
    const { year, label, teams } = request.body;
    if (!teams || teams.length < 2) {
      reply.code(400);
      return { error: "Eine Saison braucht mindestens 2 Mannschaften." };
    }

    const season = await prisma.season.create({ data: { year, label } });

    const createdTeams = [];
    for (const team of teams) {
      createdTeams.push(
        await prisma.team.create({
          data: {
            seasonId: season.id,
            name: team.name,
            trainingDay: team.trainingDay ?? null,
            trainingTime: team.trainingTime ?? null,
            location: team.location ?? null,
            contact: team.contact ?? null,
            phone: team.phone ?? null,
          },
        }),
      );
    }

    const { matches, maxWeek } = generateSchedule(createdTeams.map((t) => ({ id: t.id, name: t.name })));

    // No Shoot rows are created here - like the legacy app, a match only gets
    // Shoot rows once a result is actually saved (see PUT /matches/:id).
    // Empty display rows (4 per side) are the frontend's job, not the DB's.
    for (const m of matches) {
      await prisma.match.create({
        data: { seasonId: season.id, week: m.week, homeTeamId: m.homeTeamId, guestTeamId: m.guestTeamId },
      });
    }

    for (let week = 1; week <= maxWeek; week++) {
      await prisma.matchDate.create({ data: { seasonId: season.id, week, date: null } });
    }

      reply.code(201);
      return prisma.season.findUnique({ where: { id: season.id }, include: { teams: true } });
    },
  );

  app.get<{ Params: { id: string } }>("/seasons/:id", async (request, reply) => {
    const id = Number(request.params.id);
    const season = await prisma.season.findUnique({
      where: { id },
      include: {
        teams: true,
        matchDates: { orderBy: { week: "asc" } },
        matches: {
          orderBy: { week: "asc" },
          include: { homeTeam: true, guestTeam: true, shoots: true },
        },
      },
    });
    if (!season) {
      reply.code(404);
      return { error: "Saison nicht gefunden." };
    }
    return season;
  });

  app.get<{ Params: { id: string } }>("/seasons/:id/table", async (request, reply) => {
    const id = Number(request.params.id);
    const season = await prisma.season.findUnique({
      where: { id },
      include: { teams: true, matches: { include: { shoots: true } } },
    });
    if (!season) {
      reply.code(404);
      return { error: "Saison nicht gefunden." };
    }
    return computeTable(season.teams, season.matches);
  });

  app.get<{ Params: { id: string } }>("/seasons/:id/personal-scores", async (request, reply) => {
    const id = Number(request.params.id);
    const season = await prisma.season.findUnique({
      where: { id },
      include: { teams: true, matches: { include: { shoots: true } } },
    });
    if (!season) {
      reply.code(404);
      return { error: "Saison nicht gefunden." };
    }
    const teamNamesById = new Map(season.teams.map((t) => [t.id, t.name]));
    return computePersonalScores(season.matches, teamNamesById);
  });

  app.get<{ Params: { id: string }; Querystring: { sections?: string } }>(
    "/seasons/:id/pdf",
    async (request, reply) => {
      const id = Number(request.params.id);
      const season = await prisma.season.findUnique({
        where: { id },
        include: {
          teams: true,
          matchDates: { orderBy: { week: "asc" } },
          matches: { orderBy: { week: "asc" }, include: { homeTeam: true, guestTeam: true, shoots: true } },
        },
      });
      if (!season) {
        reply.code(404);
        return { error: "Saison nicht gefunden." };
      }

      const requested = new Set((request.query.sections ?? "dates,table,scores").split(","));
      const teamNamesById = new Map(season.teams.map((t) => [t.id, t.name]));
      const maxWeek = season.matchDates.length > 0 ? Math.max(...season.matchDates.map((d) => d.week)) : 0;

      const matchesByWeek: { week: number; homeTeam: string; guestTeam: string }[][] = Array.from(
        { length: maxWeek },
        () => [],
      );
      for (const match of season.matches) {
        matchesByWeek[match.week - 1]?.push({
          week: match.week,
          homeTeam: match.homeTeam.name,
          guestTeam: match.guestTeam.name,
        });
      }

      const pdfBytes = await generateSeasonPdf(
        { year: season.year, label: season.label, contactPerson: season.contactPerson, contactMail: season.contactMail },
        {
          dates: requested.has("dates") ? { teams: season.teams, matchesByWeek } : undefined,
          resultTable: requested.has("table") ? computeTable(season.teams, season.matches) : undefined,
          personalScores: requested.has("scores") ? computePersonalScores(season.matches, teamNamesById) : undefined,
        },
      );

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="${season.label}-${season.year}.pdf"`);
      return reply.send(Buffer.from(pdfBytes));
    },
  );
};
