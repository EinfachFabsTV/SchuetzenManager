# Technische Dokumentation

## Überblick

Dieses Repo enthält zwei Codebasen nebeneinander, bis die Neuentwicklung Feature-Parität erreicht:

- **[Legacy/](Legacy/)** (`src/`, `lib/`, `build.fxbuild`, `.project`) — Java 8 / JavaFX-Desktop-App von Christian Kater, dem ursprünglichen Autor des Projekts. Details siehe [CLAUDE.md](CLAUDE.md).
- **Rework** ([Rework/](Rework/)) — Neuentwicklung als Cross-Platform-Anwendung.

## Rework-Architektur

Eine Codebase für zwei Betriebsarten, damit Backend/Frontend nicht doppelt gepflegt werden:

```
Rework/
├── apps/
│   ├── backend/     Fastify + Prisma (TypeScript)
│   └── frontend/     React + Vite (TypeScript)
└── assets/logo/      Logo-Assets (icon.svg, lockup.svg)
```

| Modus | Frontend | Backend | Datenbank |
|---|---|---|---|
| Lokal / Desktop | React (in Tauri-Fenster) | Fastify, eingebettet als Tauri-Sidecar | SQLite (Datei) |
| Zentral gehostet | React (im Browser) | Fastify, als Docker-Container auf Webserver/VPS | Postgres |

Die Domänenlogik (Fastify-Routen, Prisma-Schema) ist in beiden Modi identisch — nur der Datenbank-Provider und die Auslieferung des Frontends unterscheiden sich. Das ersetzt den bisherigen manuellen Sync-Mechanismus (`Sync.java`, Thread-Kette mit Fastforward-Konflikterkennung) durch "ein Schreibziel für alle".

### Backend (`Rework/apps/backend`)

- **Fastify** als HTTP-Server, **Prisma** als ORM.
- `prisma/schema.prisma`: Datenmodell, abgeleitet aus dem bestehenden SQLite-Schema in [Legacy/src/database/Database.java](Legacy/src/database/Database.java), aber normalisiert mit Surrogate-Keys statt der ursprünglichen zusammengesetzten Natural Keys (`hometeam, guestteam, season, ...`).

  | Legacy-Tabelle | Rework-Modell |
  |---|---|
  | `season` + `seasonconfig` | `Season` (inkl. `infoBox`, `contactMail`, `contactPerson` als Spalten statt Key/Value-Paaren) |
  | `team` | `Team` |
  | `match` | `Match` |
  | `dates` | `MatchDate` |
  | `shoot` / `additionalshoot` | `Shoot` (Unterscheidung über `additional: Boolean` statt zweiter Tabelle) |
  | `users` (remote) | `User` |
  | `responsible` (remote) | `Responsible` |
  | `teamnameneedupdate` | entfällt — durch Surrogate-Keys sind Team-Umbenennungen reine Attribut-Updates, keine Kaskaden über Natural Keys mehr nötig |

- **Bekannte Einschränkung:** SQLite unterstützt in Prisma keine nativen Enums — `Shoot.ageGroup` (`SCHUETZENKLASSE`/`SENIOREN`) und `Shoot.teamSide` (`HOME`/`GUEST`) sind deshalb `String`-Spalten, validiert in der Anwendungsschicht statt per DB-Constraint.
- Endpunkte:
  - `GET /health`
  - `GET /seasons`, `POST /seasons` (Saison + Mannschaften anlegen, generiert automatisch den Rundenwettkampf-Spielplan über `domain/roundRobin.ts`)
  - `GET /seasons/:id` (Saison inkl. Mannschaften, Matches, Terminen)
  - `GET /seasons/:id/table` (Tabelle: Sieg/Niederlage/Unentschieden/Ringe/Punkte, siehe `domain/table.ts`)
  - `GET /seasons/:id/personal-scores` (Einzelwertung je Schütze, siehe `domain/personalScores.ts`)
  - `PUT /matches/:id` (Ergebnis eines Matches speichern, ersetzt alle Shoot-Zeilen, siehe `routes/matches.ts`)
  - `PUT /teams/:id` (Mannschaft bearbeiten/umbenennen, siehe `routes/teams.ts`). Da Matches/Shoots die Mannschaft über die Surrogate-ID referenzieren statt über den Namen, ist eine Umbenennung eine reine Attribut-Änderung — anders als in `Database.java#updateTeam()` ist kein Cascade-Update über mehrere Tabellen nötig.
  - `GET /seasons/:id/pdf?sections=dates,table,scores` (PDF-Export, siehe `domain/pdf.ts`)

### PDF-Export (`domain/pdf.ts`)

Funktionaler Nachbau von `pdf/PDFFactory.java` mit [pdf-lib](https://github.com/Hopding/pdf-lib) statt PDFBox 1.8. Gleiche drei Berichte wie im Original (Termine inkl. Mannschaftsübersicht, Gesamtergebnis, Einzelergebnisse je Altersklasse), auswählbar per `sections`-Query-Parameter wie im Original-Dialog (`MainWindow.createPdf()`). Spaltenbreiten werden wie in `calculateXBorders*()` aus der tatsächlichen Textbreite berechnet, damit lange Mannschafts-/Schützennamen nicht abgeschnitten werden.

**Bewusste Vereinfachungen gegenüber dem Original:**
- Keine Detailseiten pro Wettkampfwoche (das eigentliche Einzelmatch-Ergebnis ist im [Rework/](Rework/)-Frontend über den Wettkämpfe-Tab einsehbar, nicht zusätzlich im PDF).
- Die Einzelergebnisse-Tabelle zeigt nur Gesamt/Schnitt pro Saison, nicht die pro-Woche-Matrix des Originals.
- Der Termine-Abschnitt listet Spiele als einfache Liste pro Woche statt des mehrspaltigen Rasters im Original.

Verifiziert: Testlauf mit 4 Mannschaften + einem erfassten Ergebnis erzeugte ein gültiges PDF mit der erwarteten Seitenzahl (Termine + Gesamtergebnis + 2× Einzelergebnisse nach Altersklasse).

### Zentral-Hosting (Docker + Postgres)

Alle API-Routen liegen jetzt einheitlich unter `/api/*` (`app.register(seasonsRoutes, { prefix: "/api" })` usw. in `server.ts`) — im lokalen Dev-Modus proxied Vite `/api` unverändert an das Backend durch (`vite.config.ts`), im Docker-Image liefert derselbe Fastify-Prozess zusätzlich das gebaute Frontend als statische Dateien aus (`@fastify/static`, siehe `dist/public` im Image) inkl. SPA-Fallback für Client-seitiges Routing (unbekannte GET-Routen außerhalb `/api` liefern `index.html`, unbekannte `/api`-Routen bleiben ein sauberer 404).

**Zwei Prisma-Schema-Varianten**, da Prisma den Datasource-`provider` nicht per Umgebungsvariable parametrisieren kann (nur die `url`):
- `prisma/schema.prisma` — SQLite, lokaler/Desktop-Modus (Standard, unverändert)
- `prisma-postgresql/schema.prisma` — identische Modelle, `provider = "postgresql"`, eigene Migrations-Historie unter `prisma-postgresql/migrations/`. Beide Dateien müssen von Hand synchron gehalten werden; da keines der Modelle SQLite- oder Postgres-spezifische Konstrukte nutzt (auch keine nativen Enums, s.o.), betrifft das in der Praxis nur den `datasource`-Block.
- Wechsel zwischen den Client-Varianten lokal: `npm run prisma:generate` (SQLite) bzw. `npm run prisma:generate:postgresql` (Postgres) — regeneriert denselben `@prisma/client`-Output, daher immer nur eine Variante gleichzeitig aktiv.
- Die initiale Postgres-Migration (`prisma-postgresql/migrations/20260702000000_init/migration.sql`) wurde statisch über `prisma migrate diff --from-empty --to-schema-datamodel ... --script` erzeugt (von Prismas Schema-Engine geprüftes, valides DDL) und **nicht** gegen eine echte Postgres-Instanz angewendet — im Entwicklungs-Environment war zwar lokal PostgreSQL 18 installiert, aber keine nutzbaren Zugangsdaten verfügbar.

**Docker** (`Rework/Dockerfile`, `Rework/docker-compose.yml`): Drei-Stufen-Build (Frontend-Build → Backend-Build inkl. `prisma generate` gegen das Postgres-Schema → Runtime-Image, das Backend + gebautes Frontend enthält). Der Container-Start führt `prisma migrate deploy --schema=prisma-postgresql/schema.prisma` aus, bevor der Server startet. `docker-compose.yml` bringt einen `postgres:16`-Service mit.

**Was tatsächlich verifiziert wurde** (im Entwicklungs-Environment war weder `docker` noch eine nutzbare Postgres-Verbindung verfügbar):
- Jeder einzelne Befehl aus dem Dockerfile lokal ausgeführt: Frontend-Build (`vite build`), Backend-Build (`tsc`), `prisma generate --schema=prisma-postgresql/schema.prisma` (läuft ohne Datenbankverbindung durch).
- Die kombinierte Serving-Logik in `server.ts` (das eigentliche neue Verhalten) lokal mit dem SQLite-Build durchgespielt: gebautes Frontend nach `dist/public` kopiert, Server gestartet, `/` liefert `index.html`, `/api/seasons` liefert JSON, eine unbekannte Route liefert den SPA-Fallback, eine unbekannte `/api`-Route liefert sauber 404.
- **Nicht verifiziert:** ein echter `docker build`/`docker compose up`-Lauf und das Anwenden der Postgres-Migration gegen eine laufende Postgres-Instanz — das kann nur außerhalb dieses Environments getestet werden.

### Login / User-Management (`src/auth.ts`, `routes/auth.ts`)

Auth ist **opt-in** über die Umgebungsvariable `AUTH_ENABLED=true` — im lokalen/Desktop-Modus (Standard, keine Auth im Legacy-Code vorgesehen) bleibt das Verhalten dadurch unverändert, ohne dass Code-Pfade verzweigt werden müssen. Für zentrales Hosting aktiviert.

- `GET /api/auth/status` → `{ enabled: boolean }`, vom Frontend beim Start abgefragt (`LoginGate.tsx`).
- `POST /api/auth/register` — legt den **ersten** Account an (nur solange `User`-Tabelle leer ist, danach `403`) — löst das Henne-Ei-Problem beim ersten Deployment ohne separates Setup-Skript. Weitere Nutzer über `POST /users` (siehe unten).
- `POST /api/auth/login` — prüft Passwort via `bcryptjs` gegen den gespeicherten Hash, gibt ein JWT zurück (signiert/verifiziert direkt über `jsonwebtoken`, Secret über `JWT_SECRET`).
- `GET /api/auth/me` — validiert das JWT, liefert die aktuellen Nutzerdaten (für Session-Wiederherstellung nach Reload).
- `requireAuth`-Hook (`src/auth.ts`) ist als `preHandler` auf die schreibenden Routen gesetzt (`POST /seasons`, `PUT /matches/:id`, `PUT /teams/:id`, `POST /users`) — alle `GET`-Routen bleiben immer öffentlich, das erfüllt die "Web-Ansicht für Mannschaften/Zuschauer"-Anforderung ohne eigenen Read-Only-Modus.
- **Warum `jsonwebtoken` statt `@fastify/jwt`:** Die mit Fastify 4 kompatible Version `@fastify/jwt@8` zieht `fast-jwt@4.x` nach sich, das mehrere kritische CVEs hat (u.a. JWT-Auth-Bypass über leeres HMAC-Secret) — gepatcht erst ab einer `fast-jwt`-Version, die `@fastify/jwt@10` und damit Fastify 5 voraussetzt. Statt an Dependency-Overrides zu basteln, signiert/verifiziert `src/auth.ts` JWTs direkt mit dem gut gepflegten `jsonwebtoken`-Paket (liest den `Authorization: Bearer`-Header manuell). Der verbleibende Fastify-4→5-Umstieg (u.a. wegen einer unabhängigen `fast-uri`-Schwachstelle in Fastify 4 selbst) ist als separate Folgeaufgabe vorgemerkt.
- **Vereinfachung:** Das `salt`-Feld aus dem Legacy-Schema bleibt in der Tabelle (Migrationskompatibilität), wird von der neuen `bcryptjs`-Hashing-Logik aber nicht genutzt (bcrypt bettet den Salt in den Hash ein). Legacy-Passwort-Hashes sind nicht kompatibel — migrierte Nutzer bräuchten ein neues Passwort.

Verifiziert end-to-end (SQLite, lokal): mit `AUTH_ENABLED=false` (Standard) funktioniert alles wie vorher ohne Token. Mit `AUTH_ENABLED=true`: `POST /seasons` ohne Token → `401`; Erst-Registrierung → Token; zweite Registrierung → `403`; Login mit falschem Passwort → `401`; `POST /seasons` mit gültigem Token → `201`; `GET /seasons` bleibt ohne Token erreichbar. Im Frontend zusätzlich per Browser durchgespielt: Login-Screen erscheint, Erst-Registrierung, Saison mit Token anlegen, Session übersteht Reload, Abmelden führt zurück zum Login-Screen.

### Nutzerverwaltung + Mail (`routes/users.ts`, `src/mail.ts`)

Funktionaler Nachbau des einzigen Aufrufs von `tools/SendMail.java` im Legacy-Code (`UserAdministration.java`: neuer Webservice-Account → Mail mit Zugangsdaten):

- `GET /users` (authentifiziert) — listet alle Nutzer (ohne Passwort-Hash).
- `POST /users` (authentifiziert) — legt einen neuen Nutzer mit generiertem Einmal-Passwort an und verschickt es per Mail (`src/mail.ts`, nodemailer statt JavaMail; Config-Keys `mail.*` aus `config.properties` → `SMTP_*`/`MAIL_FROM`-Env-Variablen). Ist `SMTP_HOST` nicht gesetzt, wird nichts verschickt, sondern die fertige Nachricht geloggt (`jsonTransport`) — damit der komplette Code-Pfad auch ohne echten Mailserver testbar ist.
- **Noch offen:** ein Endpunkt, mit dem Nutzer ihr Einmal-Passwort selbst ändern können (aktuell nur admin-seitig über direktes Neuanlegen möglich).

Verifiziert end-to-end mit `AUTH_ENABLED=true` (kein echter SMTP-Server im Entwicklungs-Environment verfügbar, daher über den JSON-Transport-Fallback geprüft): Nutzer ohne Token anlegen → `401`; mit Token → `201` plus geloggte Mail mit korrektem Empfänger/Betreff/generiertem Passwort; Login mit dem aus dem Mail-Log entnommenen Passwort → erfolgreich.

### Frontend (`Rework/apps/frontend`)

- Vite + React + TypeScript, ruft das Backend über `/api/*` auf (Vite-Dev-Proxy auf Port 3001, siehe `vite.config.ts`).
- Layout orientiert sich bewusst an der bestehenden JavaFX-App: Sidebar mit Saisonliste links (`components/Sidebar.tsx`), Hauptbereich mit den drei Tabs Übersicht/Wettkämpfe/Schützen-innen (`components/SeasonView.tsx`), analog zu `MainWindow.fxml`/`ShootingAdministration.fxml`.
- `components/CreateSeasonForm.tsx`: Jahr/Bezeichnung + dynamische Mannschaftsliste, ruft `POST /seasons` auf (löst die Spielplan-Generierung im Backend aus).
- `components/OverviewTab.tsx`: Tabelle + Mannschaftsliste (`GET /seasons/:id/table`).
- `components/MatchesTab.tsx` + `MatchForm.tsx`: Matches nach Woche gruppiert, Klick öffnet die Ergebniserfassung (4 Schützen je Seite + Zusatzschützen), speichert über `PUT /matches/:id`.
- `components/ShootersTab.tsx`: Einzelwertung nach Altersklasse gefiltert (`GET /seasons/:id/personal-scores`).
- `components/PdfExportButton.tsx`: Abschnitts-Auswahl + Download, ruft `GET /seasons/:id/pdf`.
- `components/LoginGate.tsx` + `LoginForm.tsx`: fragt `GET /api/auth/status` ab; ist Auth deaktiviert, wird die App direkt gerendert (kein UI-Unterschied zum bisherigen Verhalten); ist sie aktiviert, blockiert ein Login-/Erst-Registrierungs-Screen, bis ein gültiges JWT vorliegt (in `localStorage` persistiert, an `api/client.ts`s `request()` als `Authorization`-Header angehängt).
- End-to-end manuell durchgetestet: Saison mit 2 Mannschaften angelegt (Spielplan → 2 Wochen), Ergebnis für ein Match erfasst, Tabelle/Einzelwertung aktualisierten sich korrekt ohne Reload.

### Desktop-Hülle (Tauri) — `Rework/apps/desktop`

Rust/Cargo (via `rustup`) und die Visual Studio Build Tools (MSVC C++-Toolchain, für den Windows-Linker nötig) wurden nachträglich installiert; das Projekt wurde mit `cargo tauri init` gescaffoldet (`src-tauri/`) und das Icon-Set aus [assets/logo/icon.svg](assets/logo/icon.svg) generiert (`cargo tauri icon`, iOS/Android-Varianten wieder entfernt, da nur Desktop-Targets relevant sind).

- `tauri.conf.json`: `frontendDist` zeigt auf `apps/frontend/dist`, `devUrl` auf den Vite-Dev-Server; `beforeDevCommand`/`beforeBuildCommand` wechseln ins Rework-Root und bauen/starten das Frontend über die npm-Workspace-Scripts. **Wichtig:** Beide Pfade sind relativ zu `apps/desktop` (dem Verzeichnis, das `src-tauri` enthält), nicht relativ zu `src-tauri` selbst — hat beim ersten Anlauf zu zwei falschen Pfad-Iterationen geführt, bevor es passte.
- `package.json` im Desktop-Workspace nutzt `@tauri-apps/cli` (npm), sodass kein global installiertes `cargo tauri` nötig ist — nur die Rust-Toolchain selbst.
- `Cargo.toml`: Package-Metadaten (`name`, `description`, `authors`, `repository`) von den `cargo tauri init`-Platzhaltern (`app`/"A Tauri App"/"you") auf die echten Projektwerte umgestellt — der Binary-Name ist dadurch `schuetzenmanager.exe` statt `app.exe`.
- **Verifiziert:** `npm run build --workspace apps/desktop` (→ `cargo tauri build --debug`) kompiliert erfolgreich durch und erzeugt `schuetzenmanager.exe` sowie eine MSI- und eine NSIS-Installer-Datei unter `src-tauri/target/debug/bundle/`. Die `.exe` wurde gestartet und lief stabil als eigener Prozess (WebView2-Fenster).
- **Bekannte Lücke:** Die gebaute App lädt aktuell nur das statische Frontend, ohne den Fastify-Backend-Prozess automatisch mitzustarten (kein Sidecar). `/api`-Aufrufe schlagen daher in der gebauten App fehl, solange kein Backend separat läuft. Nächster Schritt: den kompilierten Backend-Build als [Tauri-Sidecar](https://tauri.app/develop/sidecar/) einbinden (Node selbst lässt sich nicht direkt in eine Rust-Binary einbetten — Optionen sind ein gebündelter Node-Runtime-Sidecar oder eine Kompilierung des Backends zu einem eigenständigen Executable, z. B. via `pkg`/`node --experimental-sea-config`).

### Releases (`.github/workflows/release.yml`)

GitHub-Actions-Workflow, der bei einem Tag-Push (`v*`) oder manuell (`workflow_dispatch`) über `tauri-apps/tauri-action` Windows- und Linux-Builds erstellt und als [GitHub Release](../../releases) veröffentlicht (als Entwurf, `releaseDraft: true`, damit vor der öffentlichen Freigabe noch geprüft werden kann):

- **Windows** (`windows-latest`): MSI-Installer, NSIS-Setup (`.exe`) über Tauris `"targets": "all"` in `tauri.conf.json`, zusätzlich ein zusammengestelltes **portables ZIP** der rohen `.exe` als eigener Workflow-Schritt (`Compress-Archive` + `softprops/action-gh-release`).
- **Linux** (`ubuntu-22.04`): `.deb` und `.AppImage`, inkl. der laut Tauri-v2-Doku nötigen Systempakete (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, `build-essential`).
- macOS ist (noch) nicht Teil der Matrix — bei Bedarf einfach `macos-latest` im `matrix.include` ergänzen.

**Nicht verifiziert:** Der Workflow konnte in diesem Entwicklungs-Environment nicht ausgelöst werden (kein GitHub-Actions-Runner verfügbar) — YAML-Syntax wurde über `js-yaml` geprüft, die referenzierten Pfade (`Rework/package-lock.json`, `Rework/apps/desktop/src-tauri/tauri.conf.json`) existieren nachweislich, und der zugrunde liegende `cargo tauri build`-Schritt wurde lokal unter Windows erfolgreich getestet (s. o.) — der Linux-Build-Pfad selbst wurde aber nicht durchlaufen. Vor dem ersten echten Release also einmal mit `workflow_dispatch` gegenprüfen.

## Setup / lokal ausführen

Voraussetzung: Node.js ≥ 20, npm.

```bash
cd Rework
npm install

# Backend
cd apps/backend
cp .env.example .env
npx prisma migrate dev
npm run dev            # http://localhost:3001

# Frontend (zweites Terminal)
cd apps/frontend
npm run dev             # http://localhost:5173
```

## Datenmigration

`scripts/migrate-legacy.ts` (`npm run migrate:legacy --workspace apps/backend -- /pfad/zur/database.db`) liest die alte lokale `database.db` über das eingebaute `node:sqlite`-Modul (keine native Kompilierung nötig) und importiert `season`/`seasonconfig`/`team`/`match`/`dates`/`shoot`/`additionalshoot` in die neuen Prisma-Modelle. Die zusammengesetzten Natural Keys der Legacy-Tabellen (`hometeam, guestteam, season, ...`) werden dabei auf die neuen Surrogate-Keys gemappt; inkonsistente/verwaiste Zeilen (z. B. durch frühere `PRAGMA foreign_keys = OFF`-Fenster bei Team-Umbenennungen) werden übersprungen und geloggt statt den ganzen Lauf abzubrechen.

Verifiziert gegen eine synthetische Fixture-DB mit dem exakten Alt-Schema — alle Zeilen inkl. Heim-/Gast-Zuordnung und Zusatzschützen-Flag kamen korrekt an.

Noch offen: das gleiche Prinzip für die Remote-MySQL-Tabellen (`users`, `responsible`, `matches`, `shoots`, `additionalshoots`, `admins`), sobald das zentrale Hosting steht.

## Roadmap

Siehe Projekt-Historie für die vollständige Diskussion. Kurzfassung der Phasen:

| Phase | Inhalt | Status |
|---|---|---|
| 0 | Fundament: Prisma-Schema, Grundgerüst Backend/Frontend, Logo, Repo-Setup, Migrationsskript für `database.db` | ✅ abgeschlossen |
| 1 | MVP lokal: Saison-, Ergebnis-, Mannschaftsverwaltung, Tabellenberechnung (SQLite, offline) | ✅ abgeschlossen — Saison anlegen, Ergebniserfassung, Tabelle, Einzelwertung, Mannschaft bearbeiten (inkl. Umbenennen) end-to-end lauffähig |
| 2 | PDF-Export nachbauen | ✅ abgeschlossen — Termine/Gesamtergebnis/Einzelergebnisse als PDF, siehe `domain/pdf.ts` |
| 3 | Zentral-Hosting-Variante: Docker-Deployment, Postgres, Web-Ansicht, User-Management | 🟡 Docker-Image, Postgres-Schema und Login/Auth stehen (Details unten); echter Docker/Postgres-Lauf nicht verifiziert |
| 4 | Alten Sync-Mechanismus ablösen, E-Mail-Versand modernisieren | ✅ Sync durch zentrale DB (Phase 3) ersetzt; E-Mail-Versand + Nutzerverwaltung nachgebaut (siehe oben) |
| 5 | Rollout: Altdaten-Import bei den Vereinen, Parallelbetrieb, Cutover | offen |
