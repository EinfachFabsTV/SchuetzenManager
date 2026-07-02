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
- **Warum `jsonwebtoken` statt `@fastify/jwt`:** Die ursprünglich mit Fastify 4 kompatible Version `@fastify/jwt@8` zog `fast-jwt@4.x` nach sich, das mehrere kritische CVEs hatte (u.a. JWT-Auth-Bypass über leeres HMAC-Secret). `src/auth.ts` signiert/verifiziert JWTs stattdessen direkt mit dem gut gepflegten `jsonwebtoken`-Paket (liest den `Authorization: Bearer`-Header manuell) — das bleibt auch nach dem Fastify-5-Upgrade (siehe unten) unverändert, da es unabhängig von der Fastify-Version funktioniert.
- **Vereinfachung:** Das `salt`-Feld aus dem Legacy-Schema bleibt in der Tabelle (Migrationskompatibilität), wird von der neuen `bcryptjs`-Hashing-Logik aber nicht genutzt (bcrypt bettet den Salt in den Hash ein). Legacy-Passwort-Hashes sind nicht kompatibel — migrierte Nutzer bräuchten ein neues Passwort.

### Fastify-5-Upgrade

Auf `fastify@^5` + `@fastify/static@^9` aktualisiert — behebt die letzte verbleibende `npm audit`-Schwachstelle (`fast-uri`, Path-Traversal/Host-Confusion, transitiv über Fastify 4s eigene `@fastify/ajv-compiler`/`fast-json-stringify`). `npm audit` meldet danach **0 Schwachstellen**. Die zuvor wegen Fastify-4-Kompatibilität heruntergestufte `@fastify/static`-Version (`^7`, s. o.) konnte wieder auf die aktuelle Major-Version angehoben werden.

Verifiziert durch vollständiges Wiederholen der bereits bestehenden Testreihen (kein Code in den Routen musste geändert werden, nur die Dependency-Version): `tsc` kompiliert ohne Fehler; Saison/Match/Tabelle/PDF-Export/Auth-Flow (Registrierung, Login, geschützte vs. öffentliche Routen) laufen wie zuvor; statisches Frontend + `/api`-Trennung + SPA-Fallback funktionieren unverändert; der Tauri-Sidecar wurde mit den neu gestagten (Fastify-5-)`node_modules` neu gebaut und lief im vollständigen App-Kontext (Sidecar-Start, `/health`, sauberes Beenden) fehlerfrei.

### Automatisierte Tests (`npm test --workspace apps/backend`)

Die Domänenlogik (`src/domain/*.ts`) war bis hierhin nur manuell per `curl` verifiziert — jede erneute Änderung hätte dieselben Handgriffe wieder gebraucht. Jetzt gibt es eine Testsuite mit dem in Node eingebauten Test-Runner (`node:test` über `tsx --test`, keine zusätzliche Test-Library nötig):

- `matchScore.test.ts` — Top-3-von-4-Wertung, leere Eingabe, Unveränderlichkeit des Inputs.
- `table.test.ts` — Sieg/Niederlage/Unentschieden-Punktevergabe, Ringe-Summierung, dass Zusatzschützen nicht zählen, dass ein Match ohne Ergebnis die Tabelle nicht beeinflusst, Sortierreihenfolge.
- `personalScores.test.ts` — Summierung über mehrere Wochen, Schnitt nur über aktive Wochen (nicht über alle gespielten), Herausfiltern nie-erzielter Ergebnisse, getrennte Führung je Altersklasse, Sortierreihenfolge.
- `roundRobin.test.ts` — Invarianten statt exakter Werte (da randomisiert): korrekte `maxWeek`/Match-Anzahl für 2–6 Mannschaften, jedes Team-Paar trifft genau zweimal aufeinander (einmal Heim, einmal Gast), bei gerader Mannschaftszahl keine Freilose.
- `ageGroup.test.ts` — Validierung der beiden bekannten Altersklassen-Strings.

23 Tests, alle grün, Laufzeit ~300ms. `.github/workflows/ci.yml` führt bei jedem Push/PR auf `master` Typecheck + diese Tests + den Frontend-Build aus — die exakten Befehle wurden vor dem Commit lokal einzeln nachvollzogen (im Gegensatz zum Release-Workflow, der mangels GitHub-Actions-Runner nur syntaktisch geprüft werden konnte).

Verifiziert end-to-end (SQLite, lokal): mit `AUTH_ENABLED=false` (Standard) funktioniert alles wie vorher ohne Token. Mit `AUTH_ENABLED=true`: `POST /seasons` ohne Token → `401`; Erst-Registrierung → Token; zweite Registrierung → `403`; Login mit falschem Passwort → `401`; `POST /seasons` mit gültigem Token → `201`; `GET /seasons` bleibt ohne Token erreichbar. Im Frontend zusätzlich per Browser durchgespielt: Login-Screen erscheint, Erst-Registrierung, Saison mit Token anlegen, Session übersteht Reload, Abmelden führt zurück zum Login-Screen.

### Nutzerverwaltung + Mail (`routes/users.ts`, `src/mail.ts`)

Funktionaler Nachbau des einzigen Aufrufs von `tools/SendMail.java` im Legacy-Code (`UserAdministration.java`: neuer Webservice-Account → Mail mit Zugangsdaten):

- `GET /users` (authentifiziert) — listet alle Nutzer (ohne Passwort-Hash).
- `POST /users` (authentifiziert) — legt einen neuen Nutzer mit generiertem Einmal-Passwort an und verschickt es per Mail (`src/mail.ts`, nodemailer statt JavaMail; Config-Keys `mail.*` aus `config.properties` → `SMTP_*`/`MAIL_FROM`-Env-Variablen). Ist `SMTP_HOST` nicht gesetzt, wird nichts verschickt, sondern die fertige Nachricht geloggt (`jsonTransport`) — damit der komplette Code-Pfad auch ohne echten Mailserver testbar ist.
- `POST /api/auth/change-password` (authentifiziert, `routes/auth.ts`) — Nutzer können ihr (z. B. per Mail erhaltenes Einmal-) Passwort selbst ändern: prüft das aktuelle Passwort per `bcrypt.compare`, verlangt mindestens 8 Zeichen fürs neue. Frontend: `components/ChangePasswordForm.tsx`, als Overlay über `Sidebar.tsx`s "Passwort"-Button erreichbar.

Verifiziert end-to-end mit `AUTH_ENABLED=true` (kein echter SMTP-Server im Entwicklungs-Environment verfügbar, daher über den JSON-Transport-Fallback geprüft): Nutzer ohne Token anlegen → `401`; mit Token → `201` plus geloggte Mail mit korrektem Empfänger/Betreff/generiertem Passwort; Login mit dem aus dem Mail-Log entnommenen Passwort → erfolgreich. Passwort-Ändern zusätzlich per curl (falsches aktuelles Passwort → `401`, zu kurzes neues Passwort → `400`, korrekte Änderung → `200`, Login mit altem Passwort schlägt danach fehl, mit neuem funktioniert) und im Browser durchgespielt (Formular öffnen, ausfüllen, Erfolgsmeldung).

### Frontend (`Rework/apps/frontend`)

- Vite + React + TypeScript, ruft das Backend über `/api/*` auf (Vite-Dev-Proxy auf Port 3001, siehe `vite.config.ts`).
- Layout orientiert sich bewusst an der bestehenden JavaFX-App: Sidebar mit Saisonliste links (`components/Sidebar.tsx`), Hauptbereich mit den drei Tabs Übersicht/Wettkämpfe/Schützen-innen (`components/SeasonView.tsx`), analog zu `MainWindow.fxml`/`ShootingAdministration.fxml`.
- `components/CreateSeasonForm.tsx`: Jahr/Bezeichnung + dynamische Mannschaftsliste, ruft `POST /seasons` auf (löst die Spielplan-Generierung im Backend aus).
- `components/OverviewTab.tsx`: Tabelle + Mannschaftsliste (`GET /seasons/:id/table`).
- `components/MatchesTab.tsx` + `MatchForm.tsx`: Matches nach Woche gruppiert, Klick öffnet die Ergebniserfassung (4 Schützen je Seite + Zusatzschützen), speichert über `PUT /matches/:id`.
- `components/ShootersTab.tsx`: Einzelwertung nach Altersklasse gefiltert (`GET /seasons/:id/personal-scores`).
- `components/PdfExportButton.tsx`: Abschnitts-Auswahl + Download, ruft `GET /seasons/:id/pdf`.
- `components/LoginGate.tsx` + `LoginForm.tsx`: fragt `GET /api/auth/status` ab; ist Auth deaktiviert, wird die App direkt gerendert (kein UI-Unterschied zum bisherigen Verhalten); ist sie aktiviert, blockiert ein Login-/Erst-Registrierungs-Screen, bis ein gültiges JWT vorliegt (in `localStorage` persistiert, an `api/client.ts`s `request()` als `Authorization`-Header angehängt).
- `components/SplashScreen.tsx`: 5 Sekunden Start-Animation (reines SVG + CSS-Keyframes, keine Video-/Canvas-Library) — Zielscheiben-Logo baut sich ringweise auf, ein stilisiertes Gewehr feuert, die Kugel durchschlägt das Logo (Schockwelle + Risslinien + Wackler), dann blendet die gesamte Overlay aus. Läuft als Overlay über der bereits mountenden App (`App.tsx`), damit die eigentlichen Daten parallel zur Animation laden und nach deren Ende sofort sichtbar sind, statt nach dem Splash noch einmal nachzuladen. Timing-Bug beim Erstentwurf: alle drei Ringe nutzten dieselbe (nur für den äußeren Ring korrekte) Umfangs-Konstante fürs `stroke-dashoffset`-Zeichnen — behoben über eine CSS-Variable (`--sm-circ`) pro Ring statt einer gemeinsamen Konstante. Verifiziert durch Pausieren/Scrubben der Web Animations API (`document.getAnimations()`) auf mehrere Zeitpunkte sowie einen kompletten natürlichen Durchlauf.
- End-to-end manuell durchgetestet: Saison mit 2 Mannschaften angelegt (Spielplan → 2 Wochen), Ergebnis für ein Match erfasst, Tabelle/Einzelwertung aktualisierten sich korrekt ohne Reload.

### Desktop-Hülle (Tauri) — `Rework/apps/desktop`

Rust/Cargo (via `rustup`) und die Visual Studio Build Tools (MSVC C++-Toolchain, für den Windows-Linker nötig) wurden nachträglich installiert; das Projekt wurde mit `cargo tauri init` gescaffoldet (`src-tauri/`) und das Icon-Set aus [assets/logo/icon.svg](assets/logo/icon.svg) generiert (`cargo tauri icon`, iOS/Android-Varianten wieder entfernt, da nur Desktop-Targets relevant sind).

- `tauri.conf.json`: `frontendDist` zeigt auf `apps/frontend/dist`, `devUrl` auf den Vite-Dev-Server; `beforeDevCommand`/`beforeBuildCommand` wechseln ins Rework-Root und bauen/starten das Frontend über die npm-Workspace-Scripts. **Wichtig:** Beide Pfade sind relativ zu `apps/desktop` (dem Verzeichnis, das `src-tauri` enthält), nicht relativ zu `src-tauri` selbst — hat beim ersten Anlauf zu zwei falschen Pfad-Iterationen geführt, bevor es passte.
- `package.json` im Desktop-Workspace nutzt `@tauri-apps/cli` (npm), sodass kein global installiertes `cargo tauri` nötig ist — nur die Rust-Toolchain selbst.
- `Cargo.toml`: Package-Metadaten (`name`, `description`, `authors`, `repository`) von den `cargo tauri init`-Platzhaltern (`app`/"A Tauri App"/"you") auf die echten Projektwerte umgestellt — der Binary-Name ist dadurch `schuetzenmanager.exe` statt `app.exe`.
- **Verifiziert:** `npm run build --workspace apps/desktop` (→ `cargo tauri build --debug`) kompiliert erfolgreich durch und erzeugt `schuetzenmanager.exe`. Die `.exe` wurde gestartet und lief stabil als eigener Prozess (WebView2-Fenster).
- Bundle-`targets` sind auf `["nsis", "deb", "appimage"]` eingeschränkt (statt `"all"`) — die MSI-Bundlingstufe (`light.exe` aus dem WiX-Toolset) schlug mit der großen, tief verschachtelten `node_modules`-Ressourcenstruktur des Sidecars fehl (vermutlich WiX-Component-Kollisionen bei sehr vielen gleichnamigen Dateien in unterschiedlichen Verzeichnissen). Da NSIS bereits einen funktionierenden `.exe`-Installer liefert, wurde das nicht weiter debuggt statt Zeit in einen redundanten zweiten Installer-Typ zu stecken.

### Tauri-Sidecar: Backend automatisch mitstarten

Die gebaute App startet den Fastify-Backend-Prozess jetzt automatisch als Kindprozess (Tauri-"Sidecar"), inkl. einer pro Nutzer eigenen SQLite-Datenbank. Beteiligte Teile:

- **`Rework/apps/desktop/scripts/prepare-sidecar.mjs`** (neuer Build-Schritt, läuft vor `tauri build` bzw. separat als `npm run prepare-sidecar`):
  1. Baut das Backend (`tsc` → `dist/`, unverändertes ESM). Ein Bündelungsversuch mit `esbuild` wurde verworfen: Im ESM-Ausgabeformat scheiterten dynamische `require()`-Aufrufe in Fastifys Abhängigkeitsbaum (`avvio`) mit "Dynamic require ... is not supported", und das CJS-Ausgabeformat unterstützt `server.ts`s Top-Level-`await`s nicht.
  2. Installiert ein produktionsreines `node_modules` in `src-tauri/resources/backend` über ein isoliertes `npm install --omit=dev` mit einer minimalen, aus `apps/backend/package.json` abgeleiteten `package.json`.
  3. **Wichtige Falle:** `npm install` zieht nur das generische, ungenerierte `@prisma/client`-Paket. Der tatsächlich generierte Client-Code inkl. nativer Query-Engine-Binary liegt in `node_modules/.prisma/client` des Workspace-Roots (von `prisma generate`) — das Skript kopiert diesen Ordner explizit über den Platzhalter.
  4. Kopiert Prisma-Schema/-Migrationen und erzeugt per `prisma migrate deploy` eine bereits migrierte `template.db`, damit die App zur Laufzeit keine Prisma-CLI braucht, um die Datenbank eines neuen Nutzers einzurichten.
  5. Kopiert die aktuell laufende Node-Runtime (`process.execPath`) nach `src-tauri/binaries/node-<target-triple>[.exe]` — Tauri-Sidecars müssen ein echtes externes Binary sein, kein Skript. Der Ziel-Triple wird aus `process.platform`/`process.arch` abgeleitet (`win32-x64` → `x86_64-pc-windows-msvc`, `linux-x64` → `x86_64-unknown-linux-gnu`, `darwin-x64`/`darwin-arm64` → die passenden Apple-Triples), damit derselbe Skript auf allen drei GitHub-Actions-Runnern des Release-Workflows das richtige Binary erzeugt.
- **`tauri.conf.json`**: `bundle.resources: ["resources/backend"]` bündelt das gestagte Verzeichnis in die App, `bundle.externalBin: ["binaries/node"]` deklariert den Sidecar.
- **`src-tauri/src/lib.rs`**: registriert `tauri_plugin_shell`, löst im `setup()`-Hook das Backend-Verzeichnis relativ zum **Pfad der laufenden .exe** auf (`std::env::current_exe()`) — `app.path().resource_dir()` lieferte in Tests einen kaputten Pfad (nur `"C:"`) für einen unpaketierten `cargo build`-Output, während die exe-relative Auflösung in jedem tatsächlich getesteten Build-Modus (`cargo tauri build`) korrekt funktionierte. Legt eine pro Nutzer eigene Datenbank unter `app_data_dir()/database.db` an (kopiert die `template.db` beim allerersten Start), startet den Sidecar mit `DATABASE_URL`/`PORT` als Env-Variablen, und beendet ihn beim App-Exit (`RunEvent::Exit`) wieder.
- Der Sidecar-Event-Stream (stdout/stderr) wird bewusst nicht verworfen, sondern in den App-Log geschrieben (`tauri_plugin_log`, Targets `Stdout` + `LogDir`) — sowohl zur Fehlersuche als auch weil ein nie gelesener Pipe-Buffer den Kindprozess blockieren kann.
- Das Frontend erkennt den Tauri-Kontext (`"__TAURI_INTERNALS__" in window`) und spricht dann `http://localhost:3001/api` statt der relativen `/api`-URL an (`api/client.ts`) — im Tauri-Webview läuft das Frontend unter einem eigenen Origin, nicht unter dem des Backends, anders als im Docker/Dev-Modus.

**Verifiziert (kompletter End-to-End-Durchlauf, mehrfach wiederholt):** App gestartet → Sidecar-Prozess lief sichtbar im Log (`[backend] Server listening at ...`) → `curl http://localhost:3001/health` und `/api/seasons` antworteten korrekt → `database.db` wurde beim ersten Start korrekt aus der Vorlage in `%APPDATA%/de.schuetzenmanager.desktop/` kopiert → Saison per `curl` über den Sidecar angelegt → App normal beendet und neu gestartet → Saison war weiterhin vorhanden (echte Persistenz über einen Neustart hinweg bestätigt).

**Bekannte Einschränkungen:**
- Nur für Windows getestet (`x86_64-pc-windows-msvc`); die Linux/macOS-Zweige der Zielerkennung sind Code, aber nicht in einer echten Linux/macOS-Umgebung gelaufen (dort war ohnehin kein GitHub-Actions-Runner verfügbar, siehe Release-Abschnitt).
- Ein **hartes Beenden** des Hauptprozesses (Absturz, Task-Manager "Beenden", oder in diesem Test ein `taskkill`) löst `RunEvent::Exit` nicht aus, wodurch der Sidecar als verwaister Prozess weiterläuft und den Port belegt hält, bis er manuell beendet wird. Ein normales Schließen des Fensters über die UI durchläuft Tauris regulären Event-Loop und räumt korrekt auf — das ist der Pfad, den echte Nutzer verwenden, aber die Absturz-Lücke ist nicht abgesichert (z. B. über einen zusätzlichen Signal-Handler).
- Die gestagten `node_modules` werden unkomprimiert kopiert (keine Größenoptimierung); das NSIS-Setup landet dadurch bei ~36 MB.

### Releases: zwei getrennte Kanäle

Desktop-App und Server/Docker-Image werden bewusst über zwei unabhängige Workflows mit unterschiedlichen Tag-Präfixen veröffentlicht, da zentrales Hosting rein optional ist — ein Desktop-Release soll kein Docker-Image erzwingen und umgekehrt.

#### Desktop-App (`.github/workflows/release.yml`)

GitHub-Actions-Workflow, der bei einem Tag-Push (`v*`) oder manuell (`workflow_dispatch`) über `tauri-apps/tauri-action` Windows- und Linux-Builds erstellt und als [GitHub Release](../../releases) veröffentlicht (als Entwurf, `releaseDraft: true`, damit vor der öffentlichen Freigabe noch geprüft werden kann):

- **Windows** (`windows-latest`): NSIS-Setup (`.exe`) über `tauri.conf.json`s `bundle.targets` (auf `["nsis", "deb", "appimage"]` eingeschränkt, s. o. — kein MSI mehr), zusätzlich ein zusammengestelltes **portables ZIP** mit `.exe` + Sidecar-Binary + `resources/` als eigener Workflow-Schritt (`Compress-Archive` + `softprops/action-gh-release`).
- **Linux** (`ubuntu-22.04`): `.deb` und `.AppImage`, inkl. der laut Tauri-v2-Doku nötigen Systempakete (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`, `build-essential`).
- Vor dem eigentlichen Tauri-Build laufen `prisma generate` und `prepare-sidecar` (siehe oben), damit die veröffentlichten Builds einen funktionierenden Sidecar enthalten.
- macOS ist (noch) nicht Teil der Matrix — bei Bedarf einfach `macos-latest` im `matrix.include` ergänzen.

**Nicht verifiziert:** Der Workflow konnte in diesem Entwicklungs-Environment nicht ausgelöst werden (kein GitHub-Actions-Runner verfügbar) — YAML-Syntax wurde über `js-yaml` geprüft, die referenzierten Pfade (`Rework/package-lock.json`, `Rework/apps/desktop/src-tauri/tauri.conf.json`) existieren nachweislich, und der zugrunde liegende `cargo tauri build`-Schritt wurde lokal unter Windows erfolgreich getestet (s. o.) — der Linux-Build-Pfad selbst wurde aber nicht durchlaufen. Vor dem ersten echten Release also einmal mit `workflow_dispatch` gegenprüfen.

#### Server/Docker-Image (`.github/workflows/docker-release.yml`)

Eigener Workflow, ausgelöst durch einen **`server-v*`**-Tag (bewusst anderes Präfix als `v*`) oder manuell. Baut das [Dockerfile](../Rework/Dockerfile) (Build-Context `Rework/`) über `docker/build-push-action` und veröffentlicht es nach `ghcr.io/<repo-owner>/schuetzenmanager-server`, getaggt mit der Versionsnummer aus dem Tag (`docker/metadata-action`, Pattern `server-v(.*)` → `1.2.3`) sowie `latest`.

**Nicht verifiziert:** Wie schon beim Docker-Abschnitt weiter oben stand in diesem Environment weder `docker` noch ein GitHub-Actions-Runner zur Verfügung — nur YAML-Syntax geprüft. Die einzelnen Dockerfile-Schritte (Frontend-Build, Backend-Build inkl. `prisma generate:postgresql`) wurden aber erneut einzeln lokal nachvollzogen und funktionieren nach wie vor.

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
