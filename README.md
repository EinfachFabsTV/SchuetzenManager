<p align="center">
  <img src="Rework/assets/logo/lockup.svg" alt="SchützenManager" width="420" />
</p>

<p align="center">
  Verwaltung von Rundenwettkampf-Saisons für Schießsportvereine — Mannschaften, Ergebniserfassung,<br/>
  automatische Tabellen- und Einzelwertungsberechnung, PDF-Export und Web-Zugriff für Vereine/Zuschauer.
</p>

---

Ursprünglich entwickelt von **Christian Kater** als Java-8/JavaFX-Desktop-Projekt für den Schützenkreis Meppen (siehe [Legacy/](Legacy/)). Wird aktuell von Grund auf auf einen modernen, plattformunabhängigen Stack migriert (React + Fastify/Prisma, wahlweise als Desktop-App oder zentral gehostet) — siehe [TECHNICAL.md](TECHNICAL.md) für Architektur, Setup und den vollständigen Migrationsstand.

## Funktionen

- **Saisonverwaltung** — neue Rundenwettkampf-Saison anlegen, automatischer Spielplan per Round-Robin
- **Ergebniserfassung** pro Match (Heim-/Gastmannschaft, bis zu 4 Schützen + Ersatzschützen)
- **Automatische Tabellen- und Einzelwertungsberechnung**, live bei jeder Ergebniseingabe
- **Mannschaftsverwaltung** inkl. Umbenennung mit automatischer Nachführung
- **Termine & Saison-Infos** — Datum je Wettkampfwoche, Ansprechpartner/Infotext fürs PDF
- **PDF-Export** (Termine, Gesamtergebnis, Einzelergebnisse)
- **Verschlüsselte lokale Datenbank** — beim ersten Start Passwort festlegen; die Daten werden mit einem Wiederherstellungscode als Backup verschlüsselt
- **Web-Zugriff für Vereine/Zuschauer** — Ergebnisse öffentlich einsehbar, Bearbeiten nur mit Login (optional, für zentrales Hosting)

## Screenshots

<table>
<tr>
<td align="center" width="50%">

**Legacy (Java/JavaFX)**

<img src="docs/screenshots/legacy-ui-mockup.svg" alt="Nachbau der bestehenden JavaFX-Oberfläche" width="100%" />

*Nachbau anhand der FXML-Layouts, kein Live-Screenshot — läuft nur unter Java 8.*

</td>
<td align="center" width="50%">

**Rework (aktueller Stand)**

<img src="docs/screenshots/new-ui-concept.svg" alt="Aktuelle Rework-Oberfläche" width="100%" />

*Nachbau der tatsächlich lauffähigen, dunkel gehaltenen Oberfläche (fester Modus, kein Light/Dark-Umschalter).*

</td>
</tr>
</table>

## Status

| Bereich | Stand |
|---|---|
| **Legacy** (Java/JavaFX) | funktionsfähig, unverändert in [Legacy/](Legacy/) |
| **Rework — Backend** (Fastify + Prisma) | Saison anlegen (inkl. Spielplan), Ergebniserfassung, Tabelle, Einzelwertung, Mannschaftspflege, Termine & Saison-Infos, PDF-Export, Nutzer-/Verantwortlichenverwaltung + Mail-Versand, Migrationsskript für `database.db` — alles verifiziert, 47 automatisierte Tests |
| **Rework — Frontend** (React + Vite) | Saisonliste, Saison-Erstellung, Ergebniserfassung, Tabelle/Einzelwertung, Mannschaftsverwaltung, Termine & Info, PDF-Export, Einstellungen, Login — einheitliches dunkles Theme, 66 automatisierte Tests |
| **Desktop-Hülle** (Tauri) | baut erfolgreich zu `.exe` + NSIS-Installer; Backend startet automatisch als Sidecar-Prozess mit eigener Datenbank pro Nutzer — end-to-end inkl. Neustart-Persistenz getestet (nur unter Windows verifiziert) |
| **Zentrales Hosting** (Docker + Postgres + Login) | Docker-Image, Postgres-Schema/-Migration und optionales Login stehen und sind (bis auf einen echten Docker-Lauf) getestet |

Details, offene Punkte und Testprotokolle zu jedem Punkt: [TECHNICAL.md](TECHNICAL.md).

## Tests

113 automatisierte Tests, bei jedem Push/PR per [CI](.github/workflows/ci.yml) ausgeführt:

- **Backend** (`npm test --workspace apps/backend`, 47 Tests): Domänenlogik (Spielplan-Generierung, Tabellen-/Einzelwertungsberechnung) sowie End-to-End-Tests aller HTTP-Routen gegen eine echte temporäre SQLite-Datenbank (Auth, Saison-/Match-/Mannschafts-CRUD, Termine, Verantwortliche, PDF-Export, Passwort ändern, Nutzerverwaltung inkl. Mail-Versand, CORS-Preflight).
- **Frontend** (`npm test --workspace apps/frontend`, 66 Tests): Vitest + React Testing Library, u. a. Regressionstest für den früher gefundenen DELETE-Content-Type-Bug, die Formularlogik von Saison-Erstellung/Passwort-ändern/Ergebniserfassung/Mannschaftspflege/Termine, die Login-Gate-Logik (abgelaufene Token, deaktivierte Auth) sowie den Tresor-Dialog (Einrichten/Entsperren).

## Download & Installation

Die fertige App gibt es unter **[→ Releases](../../releases/latest)**. Du brauchst nichts weiter zu installieren — Datenbank und alles Nötige sind enthalten.

### Windows (empfohlen)

1. Auf der **[Releases-Seite](../../releases/latest)** unter „Assets" die Datei **`SchutzenManager_….x64-setup.exe`** herunterladen.
2. Die heruntergeladene Datei **doppelklicken**.
3. Es erscheint ein blaues Fenster **„Der Computer wurde durch Windows geschützt"** (SmartScreen). **Das ist normal und kein Grund zur Sorge** — es kommt nur, weil die App nicht mit einem (kostenpflichtigen) Zertifikat signiert ist, nicht weil etwas mit ihr nicht stimmt.
   - Auf **„Weitere Informationen"** klicken.
   - Dann erscheint der Button **„Trotzdem ausführen"** — darauf klicken.
   - *(Je nach Windows-Version stehen „Trotzdem ausführen" / „Nicht ausführen" auch direkt da — dann einfach „Trotzdem ausführen".)*
4. Den Installationsassistenten mit **„Weiter" / „Installieren"** durchklicken.
5. Die App über das **Startmenü** starten (nach „SchützenManager" suchen).
6. **Beim allerersten Start** legst du ein **Passwort** fest und bekommst einen **Wiederherstellungscode** angezeigt. Damit wird deine lokale Datenbank verschlüsselt.
   > ⚠️ **Den Wiederherstellungscode unbedingt notieren und sicher aufbewahren.** Er ist die einzige Möglichkeit, wieder an deine Daten zu kommen, falls du das Passwort vergisst. Es gibt keine Hintertür.

**Kein Installieren gewünscht?** Stattdessen die Datei `SchuetzenManager-portable-windows-x64.zip` laden, entpacken und darin `schuetzenmanager.exe` starten.

### Linux

- **Debian/Ubuntu:** `.deb` laden und installieren — `sudo dpkg -i SchutzenManager_*_amd64.deb`
- **Andere Distributionen:** `.AppImage` laden, ausführbar machen (`chmod +x SchutzenManager_*.AppImage`) und starten.

### „Unbekannter Herausgeber" — ist das sicher?

Ja. Die App ist [quelloffen (Open Source)](../../) und wird automatisch aus diesem Repository gebaut. Windows zeigt die Warnung bei **jeder** App an, die nicht mit einem kostenpflichtigen Code-Signing-Zertifikat signiert ist — das sagt nichts über den Inhalt aus. Wer ganz sichergehen will, kann die App auch selbst aus dem Quellcode bauen (siehe [TECHNICAL.md](TECHNICAL.md#setup--lokal-ausführen)).

### Server / zentrales Hosting (optional)

Für den optionalen zentral gehosteten Betrieb (mehrere Vereine, Web-Zugriff) gibt es ein eigenständiges **Docker-Image** unter `ghcr.io/einfachfabstv/schuetzenmanager-server` (eigener `server-v*`-Release-Kanal). Details: [TECHNICAL.md](TECHNICAL.md).

## Lizenz / Copyright

Der ursprüngliche Java-Code (© Christian Kater) steht unter der in [LICENSE](LICENSE) genannten Lizenz. Logo und Rework-Markenzeichen: © 2026 Fabian L.
