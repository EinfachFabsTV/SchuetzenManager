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

### Frontend (`Rework/apps/frontend`)

- Vite + React + TypeScript, ruft das Backend über `/api/*` auf (Vite-Dev-Proxy auf Port 3001, siehe `vite.config.ts`).
- Layout orientiert sich bewusst an der bestehenden JavaFX-App: Sidebar mit Saisonliste links (`components/Sidebar.tsx`), Hauptbereich mit den drei Tabs Übersicht/Wettkämpfe/Schützen-innen (`components/SeasonView.tsx`), analog zu `MainWindow.fxml`/`ShootingAdministration.fxml`.
- `components/CreateSeasonForm.tsx`: Jahr/Bezeichnung + dynamische Mannschaftsliste, ruft `POST /seasons` auf (löst die Spielplan-Generierung im Backend aus).
- `components/OverviewTab.tsx`: Tabelle + Mannschaftsliste (`GET /seasons/:id/table`).
- `components/MatchesTab.tsx` + `MatchForm.tsx`: Matches nach Woche gruppiert, Klick öffnet die Ergebniserfassung (4 Schützen je Seite + Zusatzschützen), speichert über `PUT /matches/:id`.
- `components/ShootersTab.tsx`: Einzelwertung nach Altersklasse gefiltert (`GET /seasons/:id/personal-scores`).
- End-to-end manuell durchgetestet: Saison mit 2 Mannschaften angelegt (Spielplan → 2 Wochen), Ergebnis für ein Match erfasst, Tabelle/Einzelwertung aktualisierten sich korrekt ohne Reload.

### Desktop-Hülle (Tauri) — noch offen

Noch nicht gescaffoldet, weil im Entwicklungs-Environment kein Rust/Cargo installiert war. Vorgehen, sobald verfügbar:

```bash
rustup-init   # Rust-Toolchain installieren
cd Rework/apps
npm create tauri-app@latest desktop -- --template react-ts
```

Der Tauri-Prozess soll den Fastify-Server lokal als Sidecar starten und die Vite-Build-Ausgabe des Frontends laden.

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
| 2 | PDF-Export nachbauen | offen |
| 3 | Zentral-Hosting-Variante: Docker-Deployment, Postgres, Web-Ansicht, User-Management | offen |
| 4 | Alten Sync-Mechanismus ablösen, E-Mail-Versand modernisieren | offen |
| 5 | Rollout: Altdaten-Import bei den Vereinen, Parallelbetrieb, Cutover | offen |
