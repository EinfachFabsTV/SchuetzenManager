import { useState } from "react";
import { api } from "../api/client";
import type { NewTeamInput } from "../api/client";
import { theme } from "../theme";

type Props = {
  onCreated: (seasonId: number) => void;
  onCancel: () => void;
};

const inputStyle: React.CSSProperties = {
  height: 34,
  padding: "0 10px",
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  fontSize: 13,
};

export function CreateSeasonForm({ onCreated, onCancel }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [label, setLabel] = useState("");
  const [teams, setTeams] = useState<NewTeamInput[]>([{ name: "" }, { name: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateTeam(index: number, patch: Partial<NewTeamInput>) {
    setTeams((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanTeams = teams.filter((t) => t.name.trim().length > 0);
    if (cleanTeams.length < 2) {
      setError("Bitte mindestens 2 Mannschaften mit Namen angeben.");
      return;
    }
    setSaving(true);
    try {
      const season = await api.createSeason({ year, label, teams: cleanTeams });
      onCreated(season.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Neue Kreismeisterschaft erstellen</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: theme.textMuted }}>
          Jahr
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ ...inputStyle, width: 100 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: theme.textMuted, flex: 1 }}>
          Bezeichnung
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="L.G. Auflage A"
            style={{ ...inputStyle, width: "100%" }}
          />
        </label>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Mannschaften</div>
      {teams.map((team, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={team.name}
            onChange={(e) => updateTeam(i, { name: e.target.value })}
            placeholder="Mannschaftsname"
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={team.trainingDay ?? ""}
            onChange={(e) => updateTeam(i, { trainingDay: e.target.value })}
            placeholder="Trainingstag"
            style={{ ...inputStyle, width: 130 }}
          />
          <button
            type="button"
            onClick={() => setTeams((prev) => prev.filter((_, idx) => idx !== i))}
            style={{ border: "none", background: "transparent", color: theme.danger, cursor: "pointer" }}
          >
            Entfernen
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setTeams((prev) => [...prev, { name: "" }])}
        style={{
          marginBottom: 20,
          border: `1px solid ${theme.border}`,
          background: "#fff",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        + Mannschaft
      </button>

      {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ border: `1px solid ${theme.border}`, background: "#fff", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{ border: "none", background: theme.green, color: "#fff", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}
        >
          {saving ? "Erstelle Spielplan…" : "Erstellen"}
        </button>
      </div>
    </form>
  );
}
