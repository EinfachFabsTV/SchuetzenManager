import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Brings the local SQLite database up to the current schema before the server
// starts serving. This is what lets an existing v0.1.x desktop database (or a
// restored older backup) work after a schema change: without it, the v0.2.0
// Prisma client would query columns/tables the old file doesn't have yet.
//
// Runs `prisma migrate deploy` via the bundled CLI. Only for file: (desktop/
// local) databases - central hosting (postgresql) is migrated by its own
// deploy step, and its DATABASE_URL isn't a file: URL. All shipped migrations
// are additive, so applying them can't lose data.
//
// Note: exercised only at a real desktop build - the unit tests build the app
// via buildApp() directly and never go through server.ts, so this never runs
// in `npm test`.
export function runStartupMigrations(logger: { info: (m: string) => void; error: (m: string) => void }): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) return;

  // backend root = one level up from dist/ (bundle) or src/ (dev); prisma/
  // schema.prisma + migrations sit there, which `migrate deploy` finds via cwd.
  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  let prismaCli: string;
  try {
    prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
  } catch {
    // No bundled CLI (e.g. a dev/test setup where the DB is migrated through
    // the normal workflow) - skip rather than crash.
    logger.info("Prisma-CLI nicht gefunden - Migrationslauf übersprungen.");
    return;
  }

  try {
    execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      cwd: backendDir,
      env: process.env,
      stdio: "inherit",
    });
    logger.info("Datenbank-Migrationen angewendet.");
  } catch (e) {
    // A failed migration must stop startup: serving against a half-migrated
    // database would corrupt or lose data, which is exactly what must never
    // happen.
    logger.error(`Migrationslauf fehlgeschlagen: ${String(e)}`);
    throw e;
  }
}
