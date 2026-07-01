import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { SeasonDetail, TableRow } from "../types";
import { theme } from "../theme";
import { EditTeamForm } from "./EditTeamForm";

export function OverviewTab({ season, onTeamUpdated }: { season: SeasonDetail; onTeamUpdated: () => void }) {
  const [table, setTable] = useState<TableRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);

  useEffect(() => {
    setTable(null);
    api
      .getTable(season.id)
      .then(setTable)
      .catch((err) => setError(err.message));
  }, [season.id]);

  const editingTeam = season.teams.find((t) => t.id === editingTeamId) ?? null;

  if (editingTeam) {
    return (
      <EditTeamForm
        team={editingTeam}
        onCancel={() => setEditingTeamId(null)}
        onSaved={() => {
          setEditingTeamId(null);
          onTeamUpdated();
        }}
      />
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Tabelle</h2>
      {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}
      {table && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 28 }}>
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

      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Mannschaften</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: theme.textMuted, textAlign: "left" }}>
            <th style={{ padding: "6px 8px" }}>Name</th>
            <th style={{ padding: "6px 8px" }}>Trainingstag</th>
            <th style={{ padding: "6px 8px" }}>Uhrzeit</th>
            <th style={{ padding: "6px 8px" }}>Ort</th>
            <th style={{ padding: "6px 8px" }}>Ansprechpartner</th>
            <th style={{ padding: "6px 8px" }}></th>
          </tr>
        </thead>
        <tbody>
          {season.teams.map((team) => (
            <tr key={team.id} style={{ borderTop: `1px solid ${theme.border}` }}>
              <td style={{ padding: "6px 8px" }}>{team.name}</td>
              <td style={{ padding: "6px 8px" }}>{team.trainingDay ?? "-"}</td>
              <td style={{ padding: "6px 8px" }}>{team.trainingTime ?? "-"}</td>
              <td style={{ padding: "6px 8px" }}>{team.location ?? "-"}</td>
              <td style={{ padding: "6px 8px" }}>{team.contact ?? "-"}</td>
              <td style={{ padding: "6px 8px" }}>
                <button
                  onClick={() => setEditingTeamId(team.id)}
                  style={{ border: `1px solid ${theme.border}`, background: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
                >
                  Bearbeiten
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
