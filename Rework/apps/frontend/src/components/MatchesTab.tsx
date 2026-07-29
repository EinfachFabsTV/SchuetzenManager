import { useState } from "react";
import type { Match, SeasonDetail } from "../types";
import { MatchForm } from "./MatchForm";
import { api } from "../api/client";
import { roundOfWeek, ROUND_LABEL, type Round } from "../lib/rounds";
import { theme } from "../theme";

const VIEW_KEY = "schuetzenmanager_matches_view";
type View = "woche" | "runde";

function matchStatus(match: Match): string {
  const played = match.shoots.filter((s) => !s.additional).length;
  return played === 0 ? "offen" : `${played}/8 erfasst`;
}

export function MatchesTab({
  season,
  onMatchSaved,
  onNavigate,
}: {
  season: SeasonDetail;
  onMatchSaved: (match: Match) => void;
  onNavigate: (section: string) => void;
}) {
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [dragOverWeek, setDragOverWeek] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => (localStorage.getItem(VIEW_KEY) === "runde" ? "runde" : "woche"));
  const selectedMatch = season.matches.find((m) => m.id === selectedMatchId) ?? null;

  const maxWeek = season.matches.reduce((max, m) => Math.max(max, m.week), 0);

  // Weeks are always the finest grouping; the "runde" view adds a
  // Hinrunde/Rückrunde heading in front of the relevant week groups.
  const byWeek = new Map<number, Match[]>();
  for (const match of season.matches) {
    byWeek.set(match.week, [...(byWeek.get(match.week) ?? []), match]);
  }
  const weeks = [...byWeek.keys()].sort((a, b) => a - b);

  function setViewPersisted(next: View) {
    localStorage.setItem(VIEW_KEY, next);
    setView(next);
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

  const secondaryButton: React.CSSProperties = {
    border: `1px solid ${theme.border}`,
    background: theme.surfaceAlt,
    color: theme.text,
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
  };

  const weekGroup = (week: number) => (
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
      {(byWeek.get(week) ?? []).map((match) => (
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
  );

  const renderWeeks = () => weeks.map(weekGroup);

  const renderRounds = () => {
    const rounds: Round[] = ["hin", "rueck"];
    return rounds.map((round) => {
      const roundWeeks = weeks.filter((w) => roundOfWeek(w, maxWeek) === round);
      if (roundWeeks.length === 0) return null;
      return (
        <div key={round} style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>{ROUND_LABEL[round]}</h3>
          {roundWeeks.map(weekGroup)}
        </div>
      );
    });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => onNavigate("Termine & Info")} style={secondaryButton}>
            Termine festlegen
          </button>
          <button type="button" onClick={() => onNavigate("Mannschaften")} style={secondaryButton}>
            Mannschaften-Infos
          </button>
        </div>
        <button
          type="button"
          onClick={() => setViewPersisted(view === "woche" ? "runde" : "woche")}
          style={secondaryButton}
        >
          {view === "woche" ? "Nach Hin-/Rückrunde" : "Nach Woche"}
        </button>
      </div>
      {error && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {view === "woche" ? renderWeeks() : renderRounds()}
    </div>
  );
}
