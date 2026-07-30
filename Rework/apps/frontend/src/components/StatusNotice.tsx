import { useEffect, useState } from "react";
import { shouldShow, type StatusMessage } from "../lib/statusMessage";
import { theme } from "../theme";

// Announcement banner fed by a single file in the GitHub repo. Editing that
// file reaches every running installation - no release, no build, no tokens
// needed. That is the whole point: it must stay usable when there is no
// capacity for development work.
//
// Raw GitHub caches for a few minutes, so a change shows up with a short
// delay rather than instantly. The cache-busting query keeps that delay to
// GitHub's own TTL instead of the browser's.
const STATUS_URL = "https://raw.githubusercontent.com/EinfachFabsTV/SchuetzenManager/master/status.json";

const DISMISSED_KEY = "schuetzenmanager_status_dismissed";

export function StatusNotice() {
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(() => localStorage.getItem(DISMISSED_KEY));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${STATUS_URL}?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as StatusMessage;
        if (!cancelled) setStatus(data);
      } catch {
        // Offline, GitHub unreachable or malformed file: stay silent. An
        // announcement is never important enough to disturb normal use.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!shouldShow(status, dismissedId)) return null;

  const warning = status?.level === "warning";
  function dismiss() {
    if (status?.id) localStorage.setItem(DISMISSED_KEY, status.id);
    setDismissedId(status?.id ?? null);
  }

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 16px",
        marginBottom: 20,
        borderRadius: 8,
        border: `1px solid ${warning ? theme.danger : theme.border}`,
        background: warning ? "rgba(200, 80, 80, 0.12)" : theme.surface,
        color: theme.text,
        fontSize: 13,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        {status?.title && <strong style={{ display: "block", marginBottom: 2 }}>{status.title}</strong>}
        {status?.message}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hinweis schließen"
        style={{ border: "none", background: "transparent", color: theme.textMuted, fontSize: 16, lineHeight: 1, cursor: "pointer", padding: 0 }}
      >
        ×
      </button>
    </div>
  );
}
