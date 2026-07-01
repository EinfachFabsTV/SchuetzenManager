import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { SeasonDetail } from "../types";
import { OverviewTab } from "./OverviewTab";
import { MatchesTab } from "./MatchesTab";
import { ShootersTab } from "./ShootersTab";
import { PdfExportButton } from "./PdfExportButton";
import { theme } from "../theme";

const TABS = ["Übersicht", "Wettkämpfe", "Schützen/innen"] as const;
type Tab = (typeof TABS)[number];

export function SeasonView({ seasonId }: { seasonId: number }) {
  const [season, setSeason] = useState<SeasonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Übersicht");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setSeason(null);
    setTab("Übersicht");
    api
      .getSeason(seasonId)
      .then(setSeason)
      .catch((err) => setError(err.message));
  }, [seasonId, refreshKey]);

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (!season) return <p style={{ color: theme.textMuted }}>Lädt…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Saison {season.year} · {season.label}
        </h1>
        <PdfExportButton seasonId={season.id} seasonLabel={`${season.label} ${season.year}`} />
      </div>
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${theme.border}`, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              border: "none",
              background: "transparent",
              padding: "8px 16px",
              fontSize: 13,
              cursor: "pointer",
              color: t === tab ? theme.text : theme.textMuted,
              borderBottom: t === tab ? `2px solid ${theme.green}` : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Übersicht" && <OverviewTab season={season} onTeamUpdated={() => setRefreshKey((k) => k + 1)} />}
      {tab === "Wettkämpfe" && <MatchesTab season={season} onMatchSaved={() => setRefreshKey((k) => k + 1)} />}
      {tab === "Schützen/innen" && <ShootersTab seasonId={season.id} />}
    </div>
  );
}
