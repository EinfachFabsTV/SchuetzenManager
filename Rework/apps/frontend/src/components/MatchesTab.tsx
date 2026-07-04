import { useState } from "react";
import type { Match, SeasonDetail } from "../types";
import { MatchForm } from "./MatchForm";
import { api } from "../api/client";
import { theme } from "../theme";

function matchStatus(match: Match): string {
  const played = match.shoots.filter((s) => !s.additional).length;
  return played === 0 ? "offen" : `${played}/8 erfasst`;
}

export function MatchesTab({ season, onMatchSaved }: { season: SeasonDetail; onMatchSaved: (match: Match) => void }) {
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [dragOverWeek, setDragOverWeek] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectedMatch = season.matches.find((m) => m.id === selectedMatchId) ?? null;

  const byWeek = new Map<number, Match[]>();
  for (const match of season.matches) {
    byWeek.set(match.week, [...(byWeek.get(match.week) ?? []), match]);
  }

  async function handleDrop(week: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOverWeek(null);
    const matchId = Number(e.dataTransfer.getData("text/plain"));
    const match = season.matches.find((m) => m.id === matchId);
    if (!match || match.week === week) return;
    try {
      const updated = await api.updateMatchWeek(matchId, week);
      onMatchSaved(updated);
    } catch (err) {
      setError((err as Error).message);
    }
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
      {error && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {[...byWeek.entries()].map(([week, matches]) => (
        <div
          key={week}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverWeek(week);
          }}
          onDragLeave={() => setDragOverWeek((w) => (w === week ? null : w))}
          onDrop={(e) => handleDrop(week, e)}
          style={{
            marginBottom: 18,
            borderRadius: 8,
            outline: dragOverWeek === week ? `2px dashed ${theme.green}` : "2px dashed transparent",
            outlineOffset: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 6 }}>Woche {week}</div>
          {matches.map((match) => (
            <button
              key={match.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(match.id))}
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
                background: theme.surface,
                color: theme.text,
                cursor: "grab",
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
