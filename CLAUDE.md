# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Schießsportverwaltung ("shooting sport administration") is a JavaFX desktop application for managing league results (Rundenwettkampf) for the Schützenkreis Meppen shooting association, originally written by Christian Kater. It now lives in [Legacy/](Legacy/) as a legacy, unmaintained reference while [Rework/](Rework/) builds its cross-platform successor (see [README.md](README.md) and [TECHNICAL.md](TECHNICAL.md)) — the original author has stopped development, and Java 8 is a hard requirement (JavaFX 8 / `org.eclipse.fx.ide.jdt.core.JAVAFX_CONTAINER`, `PDDocument`/`COSVisitorException` from the old PDFBox 1.8 API, etc.). Do not assume newer Java or library APIs are available.

There is no build tool (no Maven/Gradle). This is an Eclipse project (`Legacy/.project`/`Legacy/.classpath`) using the e(fx)clipse plugin (`Legacy/build.fxbuild`), with dependencies vendored as jars in [lib/](Legacy/lib). To build/run, open the project in Eclipse with the e(fx)clipse plugin installed and a Java 8 JRE, or manually compile `Legacy/src/**/*.java` against the jars in `Legacy/lib/` plus a JavaFX 8 SDK on the classpath. There are no automated tests in the repo.

Runtime data files (created next to the executable/working directory, not checked in):
- `database.db` — local SQLite database, created/migrated automatically by [src/database/Database.java](Legacy/src/database/Database.java) on first run.
- `config.properties` — read by [src/property/PropertiyFactory.java](Legacy/src/property/PropertiyFactory.java); must define at minimum `first_season_id`, and for remote sync `db_user`, `db_password`, `db_port`, `db_host`, `db_name`.

## Architecture

Classic JavaFX MVC-ish split, one package per concern, no dependency-injection framework — most cross-cutting access goes through singletons:

- **`application`** — [Main.java](Legacy/src/application/Main.java) is the JavaFX `Application` entry point; it just builds a `Stage`/`Scene` wrapping [MainWindow](Legacy/src/view/MainWindow.java).
- **`view`** — one class + matching `.fxml` per screen/dialog (e.g. `MainWindow`, `ShootingAdministration`, `MatchResult`, `MatchWeek`, `CreateSeason`, `Sync`, `UserAdministration`). Controllers load their own FXML in the constructor via `FXMLLoader` (`setRoot`/`setController` on `this`), so views are self-contained composite `Node`s (extend `VBox`/`GridPane`/etc.) rather than being wired up externally.
- **`model`** — domain objects backing a season/league: `Season` owns `Team`s, `Match`es (each holding home/guest `Shoot` results), `TableRow` (league table row), `PersonalScore` (per-shooter running totals), `Agegroup` (enum-like class of shooter age categories), `RandomRoundRobin` (round-robin schedule generator). Almost everything uses JavaFX properties/`ObservableList` so the UI updates reactively; `Season` wires listeners in `initialize()`/`addMatch()` that recompute `TableRow` standings and `PersonalScore`s whenever a `Shoot`'s score/name changes.
- **`database`** — [Database.java](Legacy/src/database/Database.java) is a singleton (`Database.getInstance()`) wrapping two JDBC connections:
  - `con`: local SQLite (`database.db`) — source of truth for the active installation, schema created inline via `CREATE TABLE IF NOT EXISTS` in the constructor.
  - `remoteCon`: a MySQL-compatible remote DB (via the vendored `jpmdbc`/`mysql-connector` driver) reachable through `initRemote()`, used only for the web-service sync feature (user accounts, per-team "responsible" contacts, and match data mirroring).
  Nearly all persistence and business logic (creating/deleting seasons, updating matches/teams, computing team-name-change propagation, remote sync) lives in this one large class — expect to read it before changing data flow.
- **`view/Sync.java`** — implements sync between local SQLite and the remote DB as a manually chained sequence of `Thread` subclasses (`SyncSeason` → `SyncHomeShoot` → `SyncGuestShoot` → next match), driven by `Database.tryFastforward()`/`UpdateMatchToRemote()`/`updateMatch()`. Conflict-resolution UI (`Conflict.fxml`/`Conflict.java`) exists but is currently commented out in `Sync.java` — conflicts are silently fast-forwarded rather than prompting the user.
- **`pdf`** — [PDFFactory.java](Legacy/src/pdf/PDFFactory.java) renders season results (dates, overall standings, per-shooter results) to PDF using the old Apache PDFBox 1.8 API (`PDPageContentStream`, `COSVisitorException`), driven manually with hand-computed x/y layout coordinates — no template/report engine.
- **`property`** — [PropertiyFactory.java](Legacy/src/property/PropertiyFactory.java) is a tiny singleton-style loader for `config.properties` (note the misspelling of "Property" in the class/file name — this is intentional/existing, not a typo to silently "fix" without checking callers).
- **`custom`** — small custom JavaFX controls (e.g. `IntegerTextField`).
- **`tools`** — utilities such as `SendMail` for outgoing email (season notifications).

### Key domain concepts
- A **Season** (`Kreismeisterschaft`) has a year/label, a set of `Team`s, and a round-robin `Match` schedule across weeks (`maxWeek`), generated by `RandomRoundRobin` when a season is created.
- Each `Match` has up to 4 `Shoot` entries per side (home/guest) plus optional `additionalshoot` entries (substitute/extra shooters), each tagged with an `Agegroup`.
- League tables (`TableRow`) and personal score charts (`PersonalScore`) are derived/reactive views recomputed from `Shoot` changes, not stored directly — don't add separate persistence for them without checking how `Season`/`Database` already reconstruct this state from the `shoot`/`match` tables.
- Local (SQLite) data is the editable working copy; the remote DB mirrors published results for an external web service, and sync is one-directional-with-fastforward, not a full merge — see `Database.tryFastforward()` for the exact conflict rules before changing sync behavior.

## Language

UI strings, comments, and domain terminology throughout the codebase are German (e.g. "Kreismeisterschaft", "Mannschaft", "Schützenklasse"). Keep new user-facing strings consistent with this.

## Rework — the active successor project

[Rework/](Rework/) is where new feature work happens; [Legacy/](Legacy/) above is frozen reference material only (port domain logic *from* it, don't add features *to* it). For full architecture, verification history, and known gaps, read [TECHNICAL.md](TECHNICAL.md) before making non-trivial changes — this section is just the command/orientation cheat sheet.

npm workspace under `Rework/` with three apps:
- **`apps/backend`** — Fastify + Prisma (TypeScript, ESM). Pure domain logic (round-robin scheduling, table/personal-score computation, PDF generation) lives in `src/domain/*.ts` and is unit-tested; `src/routes/*.ts` are thin Fastify handlers over it. Two Prisma schemas: `prisma/schema.prisma` (SQLite, default/local) and `prisma-postgresql/schema.prisma` (central hosting) — keep both in sync by hand when changing models, see TECHNICAL.md for why they can't be one file. Auth is opt-in via `AUTH_ENABLED` env var (`src/auth.ts`) so local/desktop use needs no login.
- **`apps/frontend`** — React + Vite (TypeScript). Single fixed dark theme (`src/theme.ts`, no light/dark toggle). Talks to the backend via `/api/*`; `api/client.ts` switches between a relative URL (dev proxy / same-origin hosted deployment) and `http://localhost:3001/api` when running inside the Tauri webview.
- **`apps/desktop`** — Tauri shell around the frontend, with the backend bundled as a sidecar process (see `scripts/prepare-sidecar.mjs` and TECHNICAL.md's "Tauri-Sidecar" section) so the built app doesn't need a separately-running backend.

Common commands (run from `Rework/` unless noted):
```bash
npm install                                                          # once, installs all three workspaces
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma  # once, creates/migrates dev.db
npm run dev --workspace apps/backend                                  # backend dev server (tsx watch)
npm run dev --workspace apps/frontend                                 # Vite dev server, proxies /api to the backend
npm test --workspace apps/backend                                     # domain-logic unit tests (node:test via tsx), ~300ms
npm run build --workspace apps/desktop                                 # full Tauri build incl. sidecar prep (needs Rust + platform build tools)
```

`.github/workflows/ci.yml` runs typecheck + backend tests + frontend build on every push/PR — every command in it was verified to actually pass locally before committing (unlike `release.yml`, which builds/publishes desktop installers via `tauri-apps/tauri-action` and could only be checked for valid syntax in the environment this was built in, no GitHub Actions runner available).
