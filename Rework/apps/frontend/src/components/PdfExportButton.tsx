import { useState } from "react";
import { API_BASE } from "../api/client";
import { theme } from "../theme";

const SECTIONS = [
  { key: "dates", label: "Termine" },
  { key: "table", label: "Gesamtergebnis" },
  { key: "scores", label: "Einzelergebnisse" },
  { key: "week", label: "Wettkampfwoche" },
] as const;

export function PdfExportButton({
  seasonId,
  seasonLabel,
  maxWeek = 0,
}: {
  seasonId: number;
  seasonLabel: string;
  /** Anzahl der Wettkampfwochen – steuert die Auswahl für den Wochenbericht. */
  maxWeek?: number;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({ dates: true, table: true, scores: true, week: false });
  // Vorbelegt mit der letzten Woche: der Wochenbericht wird fast immer für
  // den zuletzt gespielten Wettkampf gebraucht. "all" gibt jede Woche aus.
  const [week, setWeek] = useState<number | "all">(() => (maxWeek > 0 ? maxWeek : 1));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    const sections = SECTIONS.filter((s) => selected[s.key]).map((s) => s.key);
    if (sections.length === 0) {
      setError("Bitte mindestens einen Abschnitt auswählen.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // API_BASE (not a relative "/api") so this hits the sidecar backend
      // in the desktop app instead of the Tauri webview origin.
      const weekParam = selected.week ? `&week=${week}` : "";
      const res = await fetch(`${API_BASE}/seasons/${seasonId}/pdf?sections=${sections.join(",")}${weekParam}`);
      if (!res.ok) throw new Error(`PDF-Export fehlgeschlagen (${res.status})`);
      const buffer = await res.arrayBuffer();
      const fileName = `${seasonLabel}.pdf`;

      if ("__TAURI_INTERNALS__" in window) {
        // Desktop: native "Speichern unter" dialog + write via a Rust
        // command. A browser <a download> in the Tauri webview can't choose
        // a folder and may be blocked entirely.
        const { save } = await import("@tauri-apps/plugin-dialog");
        const path = await save({ defaultPath: fileName, filters: [{ name: "PDF", extensions: ["pdf"] }] });
        if (!path) {
          setLoading(false);
          return; // user cancelled the dialog
        }
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("save_pdf", { path, bytes: Array.from(new Uint8Array(buffer)) });
      } else {
        const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
      >
        PDF exportieren
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: 16,
            width: 220,
            zIndex: 10,
          }}
        >
          {SECTIONS.map((s) => (
            <div key={s.key}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={selected[s.key]}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                />
                {s.label}
              </label>
              {/* Die Wochenauswahl erscheint nur, wenn der Wochenbericht
                  gewählt ist – sonst wäre sie eine leere Entscheidung. */}
              {s.key === "week" && selected.week && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 8, paddingLeft: 24, color: theme.textMuted }}>
                  Woche
                  <select
                    value={week}
                    onChange={(e) => setWeek(e.target.value === "all" ? "all" : Number(e.target.value))}
                    style={{ flex: 1, background: theme.surfaceAlt, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4, padding: "2px 4px" }}
                  >
                    <option value="all">Alle Wochen</option>
                    {Array.from({ length: Math.max(maxWeek, 1) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
          {error && <p style={{ color: theme.danger, fontSize: 12 }}>{error}</p>}
          <button
            onClick={handleDownload}
            disabled={loading}
            style={{ width: "100%", border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "8px 0", cursor: "pointer", fontSize: 13 }}
          >
            {loading ? "Erstellt PDF…" : "Herunterladen"}
          </button>
        </div>
      )}
    </div>
  );
}
