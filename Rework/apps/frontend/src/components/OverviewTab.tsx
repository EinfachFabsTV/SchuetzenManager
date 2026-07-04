import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { SeasonDetail, TableRow } from "../types";
import { theme } from "../theme";

// The "Übersicht" section: the league table only. Team management lives in
// its own "Mannschaften" section (TeamsTab).
export function OverviewTab({ season }: { season: SeasonDetail }) {
  const [table, setTable] = useState<TableRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTable(null);
    api
      .getTable(season.id)
      .then(setTable)
      .catch((err) => setError(err.message));
  }, [season.id]);

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Tabelle</h2>
      {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}
      {table && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: theme.textMuted, textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Mannschaft</th>
              <th style={{ padding: "6px 8px" }}>Gew.</th>
              <th style={{ padding: "6px 8px" }}>Verl.</th>
              <th style={{ padding: "6px 8px" }}>Unent.</th>
              <th style={{ padding: "6px 8px" }}>Ringe</th>
              <th style={{ padding: "6px 8px" }}>Punkte</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr key={row.teamId} style={{ borderTop: `1px solid ${theme.border}` }}>
                <td style={{ padding: "6px 8px" }}>{row.team}</td>
                <td style={{ padding: "6px 8px" }}>{row.win}</td>
                <td style={{ padding: "6px 8px" }}>{row.loose}</td>
                <td style={{ padding: "6px 8px" }}>{row.tied}</td>
                <td style={{ padding: "6px 8px" }}>{row.rings}</td>
                <td style={{ padding: "6px 8px" }}>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
