// One-off migration from the legacy JavaFX SQLite database (see
// src/database/Database.java for the original schema) into the Rework
// Prisma schema. Usage:
//
//   npm run migrate:legacy --workspace apps/backend -- /path/to/database.db
//
// Uses node:sqlite (built into Node 22+) instead of a native driver so this
// runs without a compiler toolchain. Tolerant of orphaned/inconsistent rows
// in the legacy DB (logs and skips instead of aborting the whole run) since
// the legacy app has toggled `PRAGMA foreign_keys = OFF` during team
// renames in the past.

import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const legacyPath = process.argv[2] ?? process.env.LEGACY_DB_PATH;
if (!legacyPath) {
  console.error("Usage: migrate-legacy.ts <path-to-legacy-database.db>");
  process.exit(1);
}

const legacy = new DatabaseSync(legacyPath, { readOnly: true });
const prisma = new PrismaClient();

const stats = {
  seasons: 0,
  teams: 0,
  matches: 0,
  matchDates: 0,
  shoots: 0,
  errors: [] as string[],
};

type TeamKeyMap = Map<string, number>;
type MatchKeyMap = Map<string, number>;

function teamKey(season: number, name: string) {
  return `${season}::${name}`;
}

function matchKey(season: number, hometeam: string, guestteam: string) {
  return `${season}::${hometeam}::${guestteam}`;
}

async function migrateSeasons() {
  const seasonRows = legacy.prepare("SELECT season, year, label FROM season").all() as Array<{
    season: number;
    year: number;
    label: string;
  }>;

  for (const row of seasonRows) {
    try {
      const configRows = legacy
        .prepare("SELECT configkey, configvalue FROM seasonconfig WHERE season = ?")
        .all(row.season) as Array<{ configkey: string; configvalue: string }>;
      const config = Object.fromEntries(configRows.map((c) => [c.configkey, c.configvalue]));

      await prisma.season.create({
        data: {
          id: row.season,
          year: row.year,
          label: row.label,
          infoBox: config.infoBox ?? null,
          contactMail: config.contactMail ?? null,
          contactPerson: config.contactPerson ?? null,
        },
      });
      stats.seasons++;
    } catch (err) {
      stats.errors.push(`Season ${row.season}: ${(err as Error).message}`);
    }
  }
}

async function migrateTeams(teamIds: TeamKeyMap) {
  const teamRows = legacy
    .prepare(
      "SELECT name, season, trainingday, trainingtime, location, contact, phone FROM team",
    )
    .all() as Array<{
    name: string;
    season: number;
    trainingday: string | null;
    trainingtime: string | null;
    location: string | null;
    contact: string | null;
    phone: string | null;
  }>;

  for (const row of teamRows) {
    try {
      const team = await prisma.team.create({
        data: {
          name: row.name,
          seasonId: row.season,
          trainingDay: row.trainingday,
          trainingTime: row.trainingtime,
          location: row.location,
          contact: row.contact,
          phone: row.phone,
        },
      });
      teamIds.set(teamKey(row.season, row.name), team.id);
      stats.teams++;
    } catch (err) {
      stats.errors.push(`Team ${row.season}/${row.name}: ${(err as Error).message}`);
    }
  }
}

async function migrateMatchesAndDates(teamIds: TeamKeyMap, matchIds: MatchKeyMap) {
  const matchRows = legacy
    .prepare("SELECT hometeam, guestteam, season, week FROM match")
    .all() as Array<{ hometeam: string; guestteam: string; season: number; week: number }>;

  for (const row of matchRows) {
    const homeTeamId = teamIds.get(teamKey(row.season, row.hometeam));
    const guestTeamId = teamIds.get(teamKey(row.season, row.guestteam));
    if (!homeTeamId || !guestTeamId) {
      stats.errors.push(
        `Match ${row.season}/${row.hometeam}-${row.guestteam}: home or guest team not migrated, skipped`,
      );
      continue;
    }
    try {
      const match = await prisma.match.create({
        data: { seasonId: row.season, week: row.week, homeTeamId, guestTeamId },
      });
      matchIds.set(matchKey(row.season, row.hometeam, row.guestteam), match.id);
      stats.matches++;
    } catch (err) {
      stats.errors.push(
        `Match ${row.season}/${row.hometeam}-${row.guestteam}: ${(err as Error).message}`,
      );
    }
  }

  const dateRows = legacy.prepare("SELECT week, date, season FROM dates").all() as Array<{
    week: number;
    date: string;
    season: number;
  }>;

  for (const row of dateRows) {
    try {
      await prisma.matchDate.create({
        data: { seasonId: row.season, week: row.week, date: row.date || null },
      });
      stats.matchDates++;
    } catch (err) {
      stats.errors.push(`Date ${row.season}/week ${row.week}: ${(err as Error).message}`);
    }
  }
}

async function migrateShoots(tableName: "shoot" | "additionalshoot", matchIds: MatchKeyMap) {
  const additional = tableName === "additionalshoot";
  const rows = legacy
    .prepare(
      `SELECT hometeam, guestteam, season, firstname, lastname, agegroup, team, startid, endid, result FROM ${tableName}`,
    )
    .all() as Array<{
    hometeam: string;
    guestteam: string;
    season: number;
    firstname: string;
    lastname: string;
    agegroup: string;
    team: string;
    startid: number | null;
    endid: number | null;
    result: number;
  }>;

  for (const row of rows) {
    const matchId = matchIds.get(matchKey(row.season, row.hometeam, row.guestteam));
    if (!matchId) {
      stats.errors.push(
        `${tableName} ${row.season}/${row.hometeam}-${row.guestteam}: match not migrated, skipped`,
      );
      continue;
    }
    try {
      await prisma.shoot.create({
        data: {
          matchId,
          firstName: row.firstname,
          lastName: row.lastname,
          ageGroup: row.agegroup,
          teamSide: row.team === row.hometeam ? "HOME" : "GUEST",
          additional,
          startId: row.startid,
          endId: row.endid,
          result: row.result,
        },
      });
      stats.shoots++;
    } catch (err) {
      stats.errors.push(
        `${tableName} ${row.season}/${row.firstname} ${row.lastname}: ${(err as Error).message}`,
      );
    }
  }
}

async function main() {
  const teamIds: TeamKeyMap = new Map();
  const matchIds: MatchKeyMap = new Map();

  await migrateSeasons();
  await migrateTeams(teamIds);
  await migrateMatchesAndDates(teamIds, matchIds);
  await migrateShoots("shoot", matchIds);
  await migrateShoots("additionalshoot", matchIds);

  console.log("Migration abgeschlossen:");
  console.log(`  Saisons:        ${stats.seasons}`);
  console.log(`  Mannschaften:   ${stats.teams}`);
  console.log(`  Matches:        ${stats.matches}`);
  console.log(`  Termine:        ${stats.matchDates}`);
  console.log(`  Schuss-Zeilen:  ${stats.shoots}`);
  if (stats.errors.length > 0) {
    console.log(`\n${stats.errors.length} Zeile(n) übersprungen/fehlgeschlagen:`);
    for (const e of stats.errors) console.log(`  - ${e}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    legacy.close();
    await prisma.$disconnect();
  });
