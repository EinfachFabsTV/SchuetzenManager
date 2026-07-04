import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuthUser } from "../api/client";
import type { SeasonDetail } from "../types";
import { OverviewTab } from "./OverviewTab";
import { TeamsTab } from "./TeamsTab";
import { MatchesTab } from "./MatchesTab";
import { ShootersTab } from "./ShootersTab";
import { DatesInfoTab } from "./DatesInfoTab";
import { ResponsibleTab } from "./ResponsibleTab";
import { PdfExportButton } from "./PdfExportButton";
import { theme } from "../theme";

// The per-season sections, shown as a sidebar sub-navigation under the
// selected season (Sidebar reads the same list). "Verantwortliche" only
// applies to central hosting (webservice users), so it's offered only when
// a user is logged in.
export function seasonSections(user: AuthUser | null): string[] {
  return [
    "Übersicht",
    "Mannschaften",
    "Wettkämpfe",
    "Schützen/innen",
    "Termine & Info",
    ...(user ? ["Verantwortliche"] : []),
    "PDF-Export",
  ];
}

export function SeasonView({
  seasonId,
  section,
  user,
  onDeleted,
}: {
  seasonId: number;
  section: string;
  user: AuthUser | null;
  onDeleted: () => void;
}) {
  const [season, setSeason] = useState<SeasonDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleting, setDeleting] = useState(false);

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

  // On season switch: show the loading state.
  useEffect(() => {
    setSeason(null);
    api
      .getSeason(seasonId)
      .then(setSeason)
      .catch((err) => setError(err.message));
  }, [seasonId]);

  // In-place refresh after a save: refetch without nulling the season, so
  // the user stays in the section they were working in.
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

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Saison {season.year} · {season.label}
        </h1>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{ border: `1px solid ${theme.danger}`, background: "transparent", color: theme.danger, borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
        >
          {deleting ? "Löscht…" : "Saison löschen"}
        </button>
      </div>

      {section === "Übersicht" && <OverviewTab season={season} />}
      {section === "Mannschaften" && <TeamsTab season={season} onTeamUpdated={refresh} />}
      {section === "Wettkämpfe" && <MatchesTab season={season} onMatchSaved={refresh} />}
      {section === "Schützen/innen" && <ShootersTab seasonId={season.id} />}
      {section === "Termine & Info" && <DatesInfoTab season={season} onUpdated={refresh} />}
      {section === "Verantwortliche" && user && <ResponsibleTab seasonId={season.id} teams={season.teams} />}
      {section === "PDF-Export" && (
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>PDF-Export</h2>
          <PdfExportButton seasonId={season.id} seasonLabel={`${season.label} ${season.year}`} />
        </div>
      )}
    </div>
  );
}
