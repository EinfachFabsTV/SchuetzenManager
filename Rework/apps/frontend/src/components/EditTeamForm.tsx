import { useState } from "react";
import { api } from "../api/client";
import type { Team } from "../types";
import { theme } from "../theme";

const inputStyle: React.CSSProperties = {
  height: 34,
  padding: "0 10px",
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  fontSize: 13,
  width: "100%",
  background: theme.surfaceAlt,
  color: theme.text,
};

const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: theme.textMuted };

export function EditTeamForm({ team, onSaved, onCancel }: { team: Team; onSaved: (team: Team) => void; onCancel: () => void }) {
  const [name, setName] = useState(team.name);
  const [trainingDay, setTrainingDay] = useState(team.trainingDay ?? "");
  const [trainingTime, setTrainingTime] = useState(team.trainingTime ?? "");
  const [location, setLocation] = useState(team.location ?? "");
  const [contact, setContact] = useState(team.contact ?? "");
  const [phone, setPhone] = useState(team.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await api.updateTeam(team.id, { name, trainingDay, trainingTime, location, contact, phone });
      onSaved(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, maxWidth: 480 }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Mannschaft bearbeiten</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <label style={field}>
          Name
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={field}>
          Trainingstag
          <input style={inputStyle} value={trainingDay} onChange={(e) => setTrainingDay(e.target.value)} />
        </label>
        <label style={field}>
          Uhrzeit
          <input style={inputStyle} value={trainingTime} onChange={(e) => setTrainingTime(e.target.value)} placeholder="20:00" />
        </label>
        <label style={field}>
          Ort
          <input style={inputStyle} value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label style={field}>
          Ansprechpartner
          <input style={inputStyle} value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <label style={field}>
          Telefon
          <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>

      {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{ border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}
        >
          {saving ? "Speichert…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}
