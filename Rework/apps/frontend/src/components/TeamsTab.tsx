import { useState } from "react";
import type { SeasonDetail } from "../types";
import { theme } from "../theme";
import { EditTeamForm } from "./EditTeamForm";

// The team roster + inline edit, split out of OverviewTab so it can be its
// own "Mannschaften" section in the season sidebar sub-nav.
export function TeamsTab({ season, onTeamUpdated }: { season: SeasonDetail; onTeamUpdated: () => void }) {
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
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
                  style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
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
