import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db.js";

export type KnownShooter = { firstName: string; lastName: string };

export const shootersRoutes: FastifyPluginAsync = async (app) => {
  // Alle je erfassten Namen, saisonübergreifend - Grundlage für die
  // Namensvorschläge im Ergebnis-Formular. Legt nichts an und ändert nichts:
  // Mannschaften und Schützen werden weiterhin von Hand eingetragen, hier
  // wird nur nachgeschlagen, was es schon einmal gab.
  app.get("/shooters", async () => {
    const rows = await prisma.shoot.findMany({
      distinct: ["firstName", "lastName"],
      select: { firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    // Leere Namen entstehen durch nicht ausgefüllte Zeilen - als Vorschlag
    // wären sie nutzlos.
    return rows.filter((r) => r.firstName.trim() !== "" || r.lastName.trim() !== "");
  });
};
