# Tresor-Reset, Installations- und Deinstallations-Ablauf

Datum: 2026-07-05
Status: abgestimmt, bereit für die Umsetzungsplanung

## Ausgangslage

Zwei reale Probleme haben diesen Entwurf ausgelöst.

**Aussperrung.** Wer weder Passwort noch Recovery-Code kennt, kommt nicht mehr an
seine Daten. Das ist kryptografisch so gewollt (zufälliger 256-Bit-DEK, zweifach
unter Argon2id-KEKs gewrappt, kein Master-Key), aber es gibt aktuell **keinen
Weg**, überhaupt neu anzufangen: Die Deinstallation lässt den Datenordner stehen,
also findet eine Neuinstallation denselben Tresor wieder vor. Die Person steckt
endgültig fest.

**Blockierte Deinstallation.** Windows löscht keine Datei, die ein Prozess offen
hält. Alte Versionen (v0.1.0–v0.1.2) starteten den Sidecar als generische
`node.exe` und hatten keinen `NSIS_HOOK_PREUNINSTALL`. Der verwaiste Prozess
blockiert daher die Deinstallation, die trotzdem den Registry-Eintrag entfernt —
die App verschwindet aus „Apps & Features", bleibt aber auf der Platte liegen,
ohne aufrufbaren Deinstaller. Belegt auf dem Entwicklungsrechner: In
`%LOCALAPPDATA%\SchützenManager\` liegt genau eine übriggebliebene Datei,
`node.exe`, ohne Registry-Eintrag und ohne Verknüpfungen.

Nicht Teil des Problems: „Migrieren ohne Datenverlust" ist bereits heute der
Fall. Der Installer schreibt ausschließlich nach `%LOCALAPPDATA%\SchützenManager\`
und fasst den Datenordner `%APPDATA%\de.schuetzenmanager.desktop\` nie an. Ein
Update lässt die Datenbank also schon jetzt unberührt. Neu ist real nur die
**Reset-Möglichkeit** — plus das Stoppen der Prozesse.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Zweck des Resets | Deckt beides ab: Ausgesperrte **und** bewussten Neuanfang |
| Wo erreichbar | In der App (Hauptweg) **und** im Windows-Installer (Notnagel) |
| Alte Daten | Werden gesichert, nicht gelöscht; nur die jeweils letzte Sicherung bleibt |
| Deinstallation | Fragt nach, ob Daten mit entfernt werden; Vorauswahl „Nein" |
| Bestätigung in der App | Nutzer muss `Bestätigen` eintippen |

Der Reset in der App ist das Kernstück, weil er plattformübergreifend läuft, voll
testbar ist und den Ausgesperrt-Fall am direktesten löst — die Person braucht kein
Setup neu herunterzuladen. Der Installer-Dialog ergänzt ihn für den Fall, dass die
App gar nicht mehr startet.

## Teil 1 — `vault_reset` (Rust)

Neuer Tauri-Befehl in `Rework/apps/desktop/src-tauri/src/vault.rs`, registriert in
`lib.rs` neben den bestehenden Vault-Befehlen.

```rust
#[tauri::command]
pub fn vault_reset(app: tauri::AppHandle) -> Result<String, String>
```

Rückgabewert ist der Pfad des Sicherungsordners, damit die Oberfläche ihn anzeigen
kann. Existiert kein Tresor, ist der Aufruf ein wirkungsloser Erfolg.

### Ablauf, in genau dieser Reihenfolge

1. **Sidecar beenden.** Wird aus den Einstellungen zurückgesetzt, läuft der
   Backend-Prozess und hält `database.db` offen. `SidecarState` wird geleert und
   der Prozess beendet, sonst schlägt das Verschieben unter Windows fehl.
2. **`VaultState` leeren.** Kritisch: Der State hält DEK und Pfade. Bliebe er
   gefüllt, würde `reencrypt_on_exit` beim Beenden der App die gerade weggeräumte
   Datenbank **neu schreiben** und den Reset stillschweigend rückgängig machen.
   Das Leeren muss vor jedem Dateizugriff passieren.
3. **Alte Sicherungen entfernen.** Vorhandene `reset-backup-*`-Ordner werden
   gelöscht, damit immer genau eine Sicherung existiert und nichts endlos wächst.
4. **Neuen Sicherungsordner anlegen:** `reset-backup-JJJJ-MM-TT-HHMMSS` im
   Datenverzeichnis.
5. **Dateien hineinverschieben:** `database.db.enc`, `vault.json`,
   `database.db.enc.bak`, `vault.json.bak` sowie eine eventuell übriggebliebene
   Klartext-`database.db`. Fehlende Dateien werden übersprungen.

Verschoben wird per `fs::rename` mit Rückfall auf Kopieren-und-Löschen, falls
Quelle und Ziel auf verschiedenen Laufwerken liegen. Ein Fehlschlag beim
Verschieben einer einzelnen Datei bricht den Vorgang mit Fehlermeldung ab und
lässt den Rest unangetastet — lieber ein erkennbar halbfertiger Zustand als ein
stillschweigend zerstörter.

Nach erfolgreichem Reset meldet `vault_status` wieder `no_vault`, die App landet
also beim nächsten Aufruf in der Ersteinrichtung.

### Warum gesichert statt gelöscht

Für Ausgesperrte sind die Daten unlesbar — aber nicht wertlos. Taucht der
Recovery-Code später doch auf, ausgedruckt oder in einer alten E-Mail, sind sie
mit der Sicherung vollständig wiederherstellbar. Ohne Sicherung wären sie
unwiderruflich weg. Die Sicherung bleibt verschlüsselt; sie ist kein Sicherheits-
zugeständnis, sondern dieselbe Datei an anderer Stelle.

## Teil 2 — Reset in der Oberfläche

Eine gemeinsame Komponente
`Rework/apps/frontend/src/components/VaultResetPanel.tsx`, an zwei Stellen
eingebunden. Sie rendert nichts außerhalb von Tauri (Prüfung auf
`"__TAURI_INTERNALS__" in window`, wie in `VaultGate.tsx` und `api/client.ts`
bereits üblich).

**Verhalten.** Ein zurückhaltender Auslöser klappt eine Erklärung auf: was
verloren geht, dass eine verschlüsselte Sicherung angelegt wird und wo sie landet.
Der Bestätigungsknopf bleibt gesperrt, bis der Nutzer `Bestätigen` eintippt.
Der Vergleich ignoriert Groß-/Kleinschreibung und umgebende Leerzeichen und
akzeptiert zusätzlich `Bestaetigen`, damit es an keiner Tastaturbelegung
scheitert. Nach Erfolg zeigt das Panel den Sicherungspfad an.

**Einbindung 1 — Anmeldebildschirm.** Im `UnlockScreen` von `VaultGate.tsx` als
Link „Zugang verloren?". Nach dem Reset wechselt `status` auf `setup`, die
Ersteinrichtung beginnt.

**Einbindung 2 — Einstellungen.** In `SettingsPage.tsx` als Abschnitt
„Gefahrenzone", optisch abgesetzt in `theme.danger`. Nach dem Reset wird die
Oberfläche zurück in die Ersteinrichtung geschickt.

Fehler kommen von Tauri als einfache Zeichenketten an und werden per `String(err)`
angezeigt — dasselbe Muster wie in `VaultGate.tsx`.

## Teil 3 — Installer und Deinstaller

Erweiterung von `Rework/apps/desktop/src-tauri/installer-hooks.nsh`.

### Prozesse stoppen

In **beiden** Hooks, vor allem anderen:

- `schuetzenmanager-backend.exe` (bereits vorhanden)
- die Haupt-App `SchützenManager.exe`
- die `node.exe` **aus dem Installationsordner** — für Altinstallationen aus
  v0.1.0–v0.1.2. Gezielt nach Pfad gefiltert, damit keine fremden
  Node-Anwendungen des Nutzers getroffen werden.

Alle Aufrufe sind bewusst fehlertolerant: Bei einer Erstinstallation gibt es
nichts zu beenden, und ein Fehlschlag darf die Installation nicht aufhalten.

Zu beachten: Die Haupt-App heißt `SchützenManager.exe` — mit Umlaut, weil
`productName` in `tauri.conf.json` so gesetzt ist. Ob `taskkill` den Namen aus dem
NSIS-Skript heraus korrekt zugestellt bekommt, hängt an der Zeichenkodierung des
Skripts und lässt sich nur an einem echten Build feststellen. Fällt das durch,
ist der Rückfall, statt über den Namen über den Installationspfad zu gehen. Der
Sidecar trägt bewusst einen reinen ASCII-Namen und ist von dem Problem nicht
betroffen.

### Abfragen

**Vor der Installation** (`NSIS_HOOK_PREINSTALL`), nur wenn ein Datenordner
existiert: „Vorhandene Daten behalten oder zurücksetzen?" Bei „zurücksetzen" wird
verschoben, nicht gelöscht.

Der Installer kann `vault_reset` nicht aufrufen — er läuft, bevor die App
existiert. Er bildet die Namenskonvention aus Teil 1 daher selbst nach: vorhandene
`reset-backup-*`-Ordner entfernen, neuen Ordner mit Zeitstempel anlegen, die
Tresor-Dateien hineinverschieben. Damit sieht eine Sicherung aus dem Installer
identisch aus wie eine aus der App, und beide Wege können sich nicht gegenseitig
überholen. Diese Doppelung ist bewusst in Kauf genommen: Die Alternative wäre,
den Installer die App aufrufen zu lassen, was ihn von einer möglicherweise
kaputten Installation abhängig machen würde — genau dem Fall, für den er da ist.

**Vor der Deinstallation** (`NSIS_HOOK_PREUNINSTALL`): „Auch die gespeicherten
Saisondaten entfernen?" mit **Nein** als Vorauswahl. Bei „Ja" wird der Datenordner
entfernt.

### Die stille Ausführung — der kritische Punkt

Beide Abfragen **müssen** mit `IfSilent` abgesichert sein.

`tauri-plugin-updater` startet das Setup im Silent-Modus, **und das Setup ruft
dabei den Deinstaller der Vorversion ebenfalls still auf.** Ohne diese Absicherung
würde jedes Auto-Update entweder an einem unsichtbaren Dialog hängen bleiben oder
— erheblich schlimmer — im Deinstallations-Schritt nach den Daten fragen und sie
im ungünstigen Fall entfernen. Ein Update, das Daten löscht, wäre der genaue
Gegensatz der Anforderung.

Regel ohne Ausnahme: **Still bedeutet immer „Daten behalten".** Beide Abfragen
erscheinen ausschließlich bei manueller Ausführung durch den Nutzer.

## Testbarkeit

**Vollständig automatisiert prüfbar:**

- Rust-Unit-Tests für `vault_reset`: Dateien landen im Sicherungsordner; die
  Sicherung ist vollständig; ein vorheriger `reset-backup-*`-Ordner wird ersetzt;
  `VaultState` ist danach leer; der Aufruf ohne vorhandenen Tresor ist ein
  wirkungsloser Erfolg; nach dem Reset meldet `vault_status` wieder `no_vault`.
- Frontend-Tests für `VaultResetPanel`: Knopf bleibt gesperrt, solange das Wort
  fehlt oder falsch ist; Schreibweise und Umlaut-Variante werden akzeptiert;
  `invoke` wird mit `vault_reset` aufgerufen; ein Fehler wird angezeigt; außerhalb
  von Tauri rendert die Komponente nichts.

**Nicht automatisiert prüfbar:** Die NSIS-Änderungen. Dafür gibt es keinen Weg
außer einem echten Build und einer echten Installation — dieselbe Einschränkung,
die schon für `release.yml` galt. Betroffen ist ausgerechnet der Teil mit dem
`IfSilent`-Risiko.

Daraus folgt eine verbindliche manuelle Abnahme vor der Veröffentlichung:

1. Update von der aktuellen auf die neue Version über den Auto-Updater — es darf
   **keine** Abfrage erscheinen, und die Daten müssen danach unverändert da sein.
2. Manuelle Installation über vorhandene Daten hinweg, einmal „behalten" und
   einmal „zurücksetzen" durchgespielt.
3. Deinstallation bei laufender App, einmal mit und einmal ohne Datenentfernung.

Punkt 1 ist der wichtigste — er ist der einzige, bei dem ein Fehler fremde Daten
kostet.

## Bewusst nicht enthalten

- **Export-/Klartext-Sicherung** als eigenes Feature. Sinnvoll, aber ein eigenes
  Thema; hier würde es den Umfang sprengen.
- **Reset unter Linux über das Paket.** Der App-interne Weg deckt Linux ab; deb
  und AppImage bekommen keine eigene Abfrage.
- **Wiederherstellung aus dem Sicherungsordner per Oberfläche.** Die Sicherung
  bleibt vorerst ein manueller Rettungsanker; ein „Sicherung zurückspielen"-Knopf
  wäre ein Folgeschritt, falls sich Bedarf zeigt.

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src-tauri/src/vault.rs` | `vault_reset` + Hilfsfunktionen + Unit-Tests |
| `src-tauri/src/lib.rs` | Befehl registrieren |
| `src-tauri/installer-hooks.nsh` | Prozess-Stopp, beide Abfragen, `IfSilent` |
| `frontend/src/components/VaultResetPanel.tsx` | neu |
| `frontend/src/components/VaultResetPanel.test.tsx` | neu |
| `frontend/src/components/VaultGate.tsx` | Panel im `UnlockScreen` |
| `frontend/src/components/SettingsPage.tsx` | Abschnitt „Gefahrenzone" |
| `README.md` | Abschnitt zu Reset und Deinstallations-Problemen |
| `TECHNICAL.md` | Reset-Ablauf und die `IfSilent`-Falle dokumentieren |

`TECHNICAL.md` enthält derzeit unfertige Arbeit und wird erst am Ende angefasst.
