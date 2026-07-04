import type { SeasonSummary } from "../types";
import type { AuthUser } from "../api/client";
import { seasonSections } from "./SeasonView";
import { theme } from "../theme";

type Props = {
  seasons: SeasonSummary[];
  selectedId: number | null;
  activeSection: string;
  onSelect: (id: number) => void;
  onSectionSelect: (section: string) => void;
  onCreateClick: () => void;
  onSettingsClick: () => void;
  isSettingsActive: boolean;
  user: AuthUser | null;
  onLogout: () => void;
};

const navItem = (active: boolean): React.CSSProperties => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "8px 10px",
  marginBottom: 2,
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  background: active ? theme.greenLight : "transparent",
  color: active ? theme.green : theme.text,
  fontSize: 13,
});

const label: React.CSSProperties = { fontSize: 11, color: theme.textMuted, marginBottom: 8, textTransform: "uppercase" };

export function Sidebar({
  seasons,
  selectedId,
  activeSection,
  onSelect,
  onSectionSelect,
  onCreateClick,
  onSettingsClick,
  isSettingsActive,
  user,
  onLogout,
}: Props) {
  const selectedSeason = seasons.find((s) => s.id === selectedId) ?? null;

  return (
    <aside style={{ width: 240, background: theme.surface, padding: "20px 16px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <img src="/logo.svg" alt="" width={32} height={32} />
        <strong style={{ color: theme.green, fontSize: 15 }}>SchützenManager</strong>
      </div>
      <button
        onClick={onCreateClick}
        style={{ width: "100%", marginBottom: 16, background: theme.green, color: theme.onAccent, border: "none", borderRadius: 8, padding: "8px 0", cursor: "pointer", fontSize: 13 }}
      >
        + Neue Saison
      </button>

      <div style={label}>Saisons</div>
      {seasons.length === 0 && <p style={{ fontSize: 12, color: theme.textMuted }}>Noch keine Saison.</p>}
      {seasons.map((season) => (
        <button
          key={season.id}
          onClick={() => onSelect(season.id)}
          style={navItem(season.id === selectedId && !isSettingsActive)}
        >
          {season.label} ({season.year})
        </button>
      ))}

      {selectedSeason && !isSettingsActive && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Saison {selectedSeason.year} · {selectedSeason.label}
          </div>
          {seasonSections(user).map((s) => (
            <button key={s} onClick={() => onSectionSelect(s)} style={{ ...navItem(s === activeSection), paddingLeft: 16 }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ borderTop: `1px solid ${theme.border}`, margin: "16px 0" }} />
      <button onClick={onSettingsClick} style={navItem(isSettingsActive)}>
        ⚙ Einstellungen
      </button>

      {user && (
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>{user.realName}</div>
          <button
            onClick={onLogout}
            style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
          >
            Abmelden
          </button>
        </div>
      )}
    </aside>
  );
}
