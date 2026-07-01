import { useState } from "react";
import type { Match, SeasonDetail } from "../types";
import { MatchForm } from "./MatchForm";
import { theme } from "../theme";

function matchStatus(match: Match): string {
  const played = match.shoots.filter((s) => !s.additional).length;
  return played === 0 ? "offen" : `${played}/8 erfasst`;
}

export function MatchesTab({ season, onMatchSaved }: { season: SeasonDetail; onMatchSaved: (match: Match) => void }) {
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const selectedMatch = season.matches.find((m) => m.id === selectedMatchId) ?? null;

  const byWeek = new Map<number, Match[]>();
  for (const match of season.matches) {
    byWeek.set(match.week, [...(byWeek.get(match.week) ?? []), match]);
  }

  if (selectedMatch) {
    return (
      <MatchForm
        match={selectedMatch}
        onCancel={() => setSelectedMatchId(null)}
        onSaved={(updated) => {
          onMatchSaved(updated);
          setSelectedMatchId(null);
        }}
      />
    );
  }

  return (
    <div>
      {[...byWeek.entries()].map(([week, matches]) => (
        <div key={week} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 6 }}>Woche {week}</div>
          {matches.map((match) => (
            <button
              key={match.id}
              onClick={() => setSelectedMatchId(match.id)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                marginBottom: 6,
                border: `1px solid ${theme.border}`,
                borderRadius: 8,
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <span>
                {match.homeTeam.name} vs. {match.guestTeam.name}
              </span>
              <span style={{ color: theme.textMuted }}>{matchStatus(match)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
