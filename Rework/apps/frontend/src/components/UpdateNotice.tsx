import { useEffect, useState } from "react";
import { theme } from "../theme";

// A release is treated as a *mandatory* update when its release notes
// contain this marker (case-insensitive). Otherwise the update is optional
// and the notice can be dismissed. Put "[pflicht]" anywhere in the GitHub
// release description to force it.
const MANDATORY_MARKER = /\[(pflicht|mandatory)\]/i;

// Only runs inside the Tauri desktop shell (the web/Docker build has no
// installer to update). Same guard used across the app.
function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

type Available = { version: string; mandatory: boolean; install: () => Promise<void> };

export function UpdateNotice() {
  const [update, setUpdate] = useState<Available | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const result = await check();
        if (!result || cancelled) return;
        const mandatory = MANDATORY_MARKER.test(result.body ?? "");
        // Data safety: the encrypted database lives in the OS app-data dir,
        // which the installer never touches - only program files are
        // replaced - so installing an update never loses user data. The
        // app also re-encrypts + removes the plaintext copy on exit before
        // the installer runs.
        const install = async () => {
          setStatus("Wird heruntergeladen…");
          const { relaunch } = await import("@tauri-apps/plugin-process");
          await result.downloadAndInstall();
          setStatus("Wird installiert…");
          await relaunch();
        };
        setUpdate({ version: result.version, mandatory, install });
      } catch {
        // Offline or GitHub unreachable: silently skip, never block startup.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update || (dismissed && !update.mandatory)) return null;

  const installing = status !== null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: update.mandatory ? theme.danger : theme.greenLight,
        color: update.mandatory ? theme.onAccent : theme.text,
        fontSize: 13,
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      }}
    >
      <span style={{ flex: 1 }}>
        {update.mandatory ? (
          <>
            <strong>Wichtiges Update erforderlich</strong> — Version {update.version} muss installiert werden.
          </>
        ) : (
          <>Eine neue Version ({update.version}) ist verfügbar.</>
        )}
        {status && <span style={{ marginLeft: 8, opacity: 0.9 }}>{status}</span>}
      </span>
      <button
        onClick={update.install}
        disabled={installing}
        style={{ border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: installing ? "default" : "pointer" }}
      >
        {installing ? "Bitte warten…" : "Jetzt aktualisieren"}
      </button>
      {!update.mandatory && !installing && (
        <button
          onClick={() => setDismissed(true)}
          style={{ border: "none", background: "transparent", color: theme.text, fontSize: 13, cursor: "pointer" }}
        >
          Später
        </button>
      )}
    </div>
  );
}
