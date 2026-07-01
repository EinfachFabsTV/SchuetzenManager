import type { SeasonSummary } from "../types";
import { theme } from "../theme";

type Props = {
  seasons: SeasonSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreateClick: () => void;
};

export function Sidebar({ seasons, selectedId, onSelect, onCreateClick }: Props) {
  return (
    <aside style={{ width: 220, background: theme.bg, padding: "20px 16px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <img src="/logo.svg" alt="" width={32} height={32} />
        <strong style={{ color: theme.green, fontSize: 15 }}>SchützenManager</strong>
      </div>
      <button
        onClick={onCreateClick}
        style={{
          width: "100%",
          marginBottom: 16,
          background: theme.green,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "8px 0",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        + Neue Saison
      </button>
      <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8, textTransform: "uppercase" }}>
        Saisons
      </div>
      {seasons.length === 0 && <p style={{ fontSize: 12, color: theme.textMuted }}>Noch keine Saison.</p>}
      {seasons.map((season) => (
        <button
          key={season.id}
          onClick={() => onSelect(season.id)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "8px 10px",
            marginBottom: 4,
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: season.id === selectedId ? theme.greenLight : "transparent",
            color: season.id === selectedId ? theme.green : theme.text,
            fontSize: 13,
          }}
        >
          {season.label} ({season.year})
        </button>
      ))}
    </aside>
  );
}
