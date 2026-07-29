import { useEffect, useState } from "react";
import { theme } from "../theme";

function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

const SUPPORT_URL = "https://projects.orfabs.de/contact";

// Opens the support page in the system browser. Inside Tauri the shell
// opener is used so it lands in the real browser instead of the app webview;
// on the web it's a normal new-tab link.
async function openSupport() {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(SUPPORT_URL);
  } else {
    window.open(SUPPORT_URL, "_blank", "noopener");
  }
}

const linkStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: theme.textMuted,
  fontSize: 11,
  cursor: "pointer",
  textDecoration: "underline",
  padding: 0,
};

// Bottom-left: shows the installed version and a button to check for
// updates manually (in addition to the automatic check on startup), plus a
// "Fehler melden" link to the support page.
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

  return (
    <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
      {isTauri() && (
        <>
          <div>Version {version ?? "…"}</div>
          <button type="button" onClick={checkForUpdates} disabled={busy} style={{ ...linkStyle, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Prüft…" : "Auf Updates prüfen"}
          </button>
          {status && <div style={{ color: theme.green }}>{status}</div>}
        </>
      )}
      <button type="button" onClick={openSupport} style={linkStyle}>
        Fehler melden
      </button>
    </div>
  );
}
