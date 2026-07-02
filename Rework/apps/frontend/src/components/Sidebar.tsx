import { useState } from "react";
import type { SeasonSummary } from "../types";
import type { AuthUser } from "../api/client";
import { theme } from "../theme";
import { ChangePasswordForm } from "./ChangePasswordForm";

type Props = {
  seasons: SeasonSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreateClick: () => void;
  user: AuthUser | null;
  onLogout: () => void;
};

export function Sidebar({ seasons, selectedId, onSelect, onCreateClick, user, onLogout }: Props) {
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <aside style={{ width: 220, background: theme.surface, padding: "20px 16px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
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
          color: theme.onAccent,
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
      {user && (
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>{user.realName}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setShowChangePassword(true)}
              style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
            >
              Passwort
            </button>
            <button
              onClick={onLogout}
              style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
            >
              Abmelden
            </button>
          </div>
        </div>
      )}
      {showChangePassword && <ChangePasswordForm onClose={() => setShowChangePassword(false)} />}
    </aside>
  );
}
