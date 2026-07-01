import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { PersonalScoreRow } from "../types";
import { AGE_GROUPS } from "../types";
import { theme } from "../theme";

export function ShootersTab({ seasonId }: { seasonId: number }) {
  const [scores, setScores] = useState<PersonalScoreRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<string>(AGE_GROUPS[0]);

  useEffect(() => {
    setScores(null);
    api
      .getPersonalScores(seasonId)
      .then(setScores)
      .catch((err) => setError(err.message));
  }, [seasonId]);

  if (error) return <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>;
  if (!scores) return <p style={{ fontSize: 13, color: theme.textMuted }}>Lädt…</p>;

  const filtered = scores.filter((s) => s.ageGroup === ageGroup);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {AGE_GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setAgeGroup(g)}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 13,
              cursor: "pointer",
              background: g === ageGroup ? theme.greenLight : "transparent",
              color: g === ageGroup ? theme.green : theme.text,
            }}
          >
            {g}
          </button>
        ))}
      </div>
      {filtered.length === 0 && <p style={{ fontSize: 13, color: theme.textMuted }}>Keine Ergebnisse.</p>}
      {filtered.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: theme.textMuted, textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Schütze/in</th>
              <th style={{ padding: "6px 8px" }}>Mannschaft</th>
              <th style={{ padding: "6px 8px" }}>Gesamt</th>
              <th style={{ padding: "6px 8px" }}>Schnitt</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${theme.border}` }}>
                <td style={{ padding: "6px 8px" }}>{row.shooter}</td>
                <td style={{ padding: "6px 8px" }}>{row.team}</td>
                <td style={{ padding: "6px 8px" }}>{row.total}</td>
                <td style={{ padding: "6px 8px" }}>{row.mean}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
