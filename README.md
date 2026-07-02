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
- **PDF-Export** (Termine, Gesamtergebnis, Einzelergebnisse)
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
| **Rework — Backend** (Fastify + Prisma) | Saison anlegen (inkl. Spielplan), Ergebniserfassung, Tabelle, Einzelwertung, Mannschaftspflege, PDF-Export, Nutzerverwaltung + Mail-Versand, Migrationsskript für `database.db` — alles verifiziert |
| **Rework — Frontend** (React + Vite) | Saisonliste, Saison-Erstellung, Ergebniserfassung, Tabelle/Einzelwertung, Mannschaftsverwaltung, PDF-Export, Login — einheitliches dunkles Theme |
| **Desktop-Hülle** (Tauri) | baut erfolgreich zu `.exe` + NSIS-Installer; Backend startet automatisch als Sidecar-Prozess mit eigener Datenbank pro Nutzer — end-to-end inkl. Neustart-Persistenz getestet (nur unter Windows verifiziert) |
| **Zentrales Hosting** (Docker + Postgres + Login) | Docker-Image, Postgres-Schema/-Migration und optionales Login stehen und sind (bis auf einen echten Docker-Lauf) getestet |

Details, offene Punkte und Testprotokolle zu jedem Punkt: [TECHNICAL.md](TECHNICAL.md).

## Download

Zwei getrennte Release-Kanäle, da zentrales Hosting rein optional ist:

- **Desktop-App** (Windows-Installer, portables ZIP, Linux `.deb`/`.AppImage`): über die [GitHub Releases](../../releases) dieses Repos, ausgelöst durch einen `v*`-Tag.
- **Server/Docker-Image** (für zentrales Hosting, siehe [TECHNICAL.md](TECHNICAL.md)): als eigenständiges Docker-Image unter `ghcr.io/einfachfabstv/schuetzenmanager-server`, ausgelöst durch einen separaten `server-v*`-Tag — unabhängig von den Desktop-Releases.

Bis zum ersten veröffentlichten Release: selbst bauen, siehe [TECHNICAL.md](TECHNICAL.md#setup--lokal-ausführen).

## Lizenz / Copyright

Der ursprüngliche Java-Code (© Christian Kater) steht unter der in [LICENSE](LICENSE) genannten Lizenz. Logo und Rework-Markenzeichen: © 2026 Fabian L.
