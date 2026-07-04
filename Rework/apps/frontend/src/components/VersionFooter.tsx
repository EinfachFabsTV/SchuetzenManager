import { useEffect, useState } from "react";
import { theme } from "../theme";

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

// Bottom-left: shows the installed version and a button to check for
// updates manually (in addition to the automatic check on startup).
export function VersionFooter() {
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/api/app").then(({ getVersion }) => getVersion().then(setVersion).catch(() => {}));
  }, []);

  async function checkForUpdates() {
    setStatus(null);
    setBusy(true);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        setStatus("Du hast die neueste Version.");
        return;
      }
      setStatus(`Version ${update.version} wird installiert…`);
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await update.downloadAndInstall();
      await relaunch();
    } catch {
      setStatus("Update-Prüfung fehlgeschlagen (offline?).");
    } finally {
      setBusy(false);
    }
  }

  if (!isTauri()) return null;

  return (
    <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted }}>
      <div>Version {version ?? "…"}</div>
      <button
        type="button"
        onClick={checkForUpdates}
        disabled={busy}
        style={{ marginTop: 4, border: "none", background: "transparent", color: theme.textMuted, fontSize: 11, cursor: busy ? "default" : "pointer", textDecoration: "underline", padding: 0 }}
      >
        {busy ? "Prüft…" : "Auf Updates prüfen"}
      </button>
      {status && <div style={{ marginTop: 4, color: theme.green }}>{status}</div>}
    </div>
  );
}
