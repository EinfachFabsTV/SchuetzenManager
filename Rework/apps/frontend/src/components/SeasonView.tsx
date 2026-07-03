import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuthUser } from "../api/client";
import type { SeasonDetail } from "../types";
import { OverviewTab } from "./OverviewTab";
import { MatchesTab } from "./MatchesTab";
import { ShootersTab } from "./ShootersTab";
import { DatesInfoTab } from "./DatesInfoTab";
import { ResponsibleTab } from "./ResponsibleTab";
import { PdfExportButton } from "./PdfExportButton";
import { theme } from "../theme";

export function SeasonView({ seasonId, user, onDeleted }: { seasonId: number; user: AuthUser | null; onDeleted: () => void }) {
  const [season, setSeason] = useState<SeasonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("Übersicht");
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // "Verantwortliche" only applies to central hosting (webservice users),
  // so it's only offered when a user is logged in.
  const tabs = ["Übersicht", "Wettkämpfe", "Schützen/innen", "Termine & Info", ...(user ? ["Verantwortliche"] : [])];

  async function handleDelete() {
    if (!season) return;
    if (!window.confirm(`Die Saison ${season.label} ${season.year} soll gelöscht werden?`)) return;
    setDeleting(true);
    try {
      await api.deleteSeason(season.id);
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  }

  // On season switch: show the loading state and reset to the first tab.
  useEffect(() => {
    setSeason(null);
    setTab("Übersicht");
    api
      .getSeason(seasonId)
      .then(setSeason)
      .catch((err) => setError(err.message));
  }, [seasonId]);

  // On an in-place refresh (a save in one of the tabs): refetch without
  // nulling the season or resetting the tab, so the user stays where they
  // were instead of being bounced back to "Übersicht".
  useEffect(() => {
    if (refreshKey === 0) return;
    api
      .getSeason(seasonId)
      .then(setSeason)
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (!season) return <p style={{ color: theme.textMuted }}>Lädt…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Saison {season.year} · {season.label}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <PdfExportButton seasonId={season.id} seasonLabel={`${season.label} ${season.year}`} />
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ border: `1px solid ${theme.danger}`, background: "transparent", color: theme.danger, borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
          >
            {deleting ? "Löscht…" : "Saison löschen"}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${theme.border}`, marginBottom: 20 }}>
        {tabs.map((t) => (
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
      {tab === "Termine & Info" && <DatesInfoTab season={season} onUpdated={() => setRefreshKey((k) => k + 1)} />}
      {tab === "Verantwortliche" && <ResponsibleTab seasonId={season.id} teams={season.teams} />}
    </div>
  );
}
