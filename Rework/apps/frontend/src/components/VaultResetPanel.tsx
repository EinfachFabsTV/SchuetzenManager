import { useState } from "react";
import { theme } from "../theme";

// Typed confirmation, so the button can't be hit out of frustration on the
// unlock screen - which is exactly where a locked-out user is clicking
// around. Compared case-insensitively and trimmed, and the umlaut-free
// spelling counts too, so no keyboard layout can block the one way back.
const CONFIRM_WORDS = ["bestätigen", "bestaetigen"];

function isResetConfirmed(value: string): boolean {
  return CONFIRM_WORDS.includes(value.trim().toLowerCase());
}

// The desktop vault only exists inside Tauri; the same bundle also serves
// the web/Docker deployment, where there is nothing to reset (same check as
// VaultGate.tsx and api/client.ts).
function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

/**
 * Wipes the local vault and returns the app to first-run setup, keeping the
 * old encrypted files in a backup folder.
 *
 * This is the only way back for someone who has lost both their password
 * and their recovery code: the data itself is unrecoverable by design, but
 * without this they can't even start over, since uninstalling leaves the
 * data directory behind and a reinstall finds the same vault again.
 */
export function VaultResetPanel({ onReset }: { onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [backupPath, setBackupPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  if (!isTauri()) return null;

  async function handleReset() {
    setError(null);
    setResetting(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      setBackupPath(await invoke<string>("vault_reset"));
    } catch (err) {
      setError(String(err));
    } finally {
      setResetting(false);
    }
  }

  if (backupPath) {
    return (
      <div style={{ marginTop: 16, fontSize: 13 }}>
        <p style={{ marginBottom: 8 }}>Der Tresor wurde zurückgesetzt.</p>
        <p style={{ color: theme.textMuted, marginBottom: 8 }}>
          Die alten Daten liegen weiterhin verschlüsselt in diesem Ordner. Findest du deinen
          Wiederherstellungscode später wieder, sind sie damit noch zu retten:
        </p>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            background: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            padding: "8px 10px",
            marginBottom: 12,
            wordBreak: "break-all",
          }}
        >
          {backupPath}
        </p>
        <button
          type="button"
          onClick={onReset}
          style={{ width: "100%", border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "10px 0", fontSize: 14 }}
        >
          Weiter zur Ersteinrichtung
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ marginTop: 16, border: "none", background: "none", color: theme.textMuted, fontSize: 12, textDecoration: "underline", padding: 0 }}
      >
        Zugang verloren?
      </button>
    );
  }

  const confirmed = isResetConfirmed(confirmation);

  return (
    <div style={{ marginTop: 16, border: `1px solid ${theme.danger}`, borderRadius: 8, padding: 14, fontSize: 13 }}>
      <strong style={{ display: "block", color: theme.danger, marginBottom: 8 }}>Tresor zurücksetzen</strong>
      <p style={{ color: theme.textMuted, marginBottom: 8 }}>
        Kennst du weder Passwort noch Wiederherstellungscode, kommst du an die gespeicherten Daten nicht mehr
        heran - sie sind verschlüsselt und lassen sich ohne eines der beiden nicht öffnen.
      </p>
      <p style={{ color: theme.textMuted, marginBottom: 12 }}>
        Du kannst hier von vorn anfangen. Die alten Daten werden dabei nicht gelöscht, sondern verschlüsselt in
        einen Sicherungsordner verschoben - falls dein Code doch noch auftaucht.
      </p>
      <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
        Tippe <strong>Bestätigen</strong> ein, um fortzufahren
      </label>
      <input
        aria-label="Bestätigung"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        style={{
          height: 36,
          padding: "0 10px",
          border: `1px solid ${theme.border}`,
          borderRadius: 6,
          fontSize: 14,
          width: "100%",
          background: theme.surfaceAlt,
          color: theme.text,
          marginBottom: 12,
        }}
      />
      {error && <p style={{ color: theme.danger, marginBottom: 12 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmation("");
            setError(null);
          }}
          style={{ flex: 1, border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "9px 0", fontSize: 13 }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!confirmed || resetting}
          style={{ flex: 1, border: "none", background: theme.danger, color: "#fff", borderRadius: 6, padding: "9px 0", fontSize: 13 }}
        >
          {resetting ? "Setze zurück…" : "Zurücksetzen"}
        </button>
      </div>
    </div>
  );
}
