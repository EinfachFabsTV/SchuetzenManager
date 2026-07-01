import { useState } from "react";
import { api } from "../api/client";
import type { ShootFormRow } from "../api/client";
import type { Match } from "../types";
import { AGE_GROUPS } from "../types";
import { theme } from "../theme";

type Row = {
  firstName: string;
  lastName: string;
  ageGroup: string;
  startId: string;
  endId: string;
  result: string;
};

const emptyRow = (): Row => ({ firstName: "", lastName: "", ageGroup: AGE_GROUPS[0], startId: "", endId: "", result: "" });

function toFormRows(shoots: Match["shoots"], side: "HOME" | "GUEST", additional: boolean, padTo: number): Row[] {
  const rows = shoots
    .filter((s) => s.teamSide === side && s.additional === additional)
    .map((s) => ({
      firstName: s.firstName,
      lastName: s.lastName,
      ageGroup: s.ageGroup,
      startId: s.startId?.toString() ?? "",
      endId: s.endId?.toString() ?? "",
      result: s.result.toString(),
    }));
  while (rows.length < padTo) rows.push(emptyRow());
  return rows;
}

function toApiRows(rows: Row[]): ShootFormRow[] {
  return rows.map((r) => ({
    firstName: r.firstName,
    lastName: r.lastName,
    ageGroup: r.ageGroup,
    startId: r.startId === "" ? null : Number(r.startId),
    endId: r.endId === "" ? null : Number(r.endId),
    result: r.result === "" ? 0 : Number(r.result),
  }));
}

function ShootRows({ rows, onChange }: { rows: Row[]; onChange: (rows: Row[]) => void }) {
  function update(i: number, patch: Partial<Row>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  const cell: React.CSSProperties = { height: 30, padding: "0 6px", border: `1px solid ${theme.border}`, borderRadius: 4, fontSize: 12 };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 1.2fr 0.8fr 0.8fr 0.8fr", gap: 6, fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>
        <div>Vorname</div>
        <div>Nachname</div>
        <div>Altersklasse</div>
        <div>Start</div>
        <div>Ende</div>
        <div>Ringe</div>
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1.3fr 1.3fr 1.2fr 0.8fr 0.8fr 0.8fr", gap: 6, marginBottom: 6 }}>
          <input style={cell} value={row.firstName} onChange={(e) => update(i, { firstName: e.target.value })} />
          <input style={cell} value={row.lastName} onChange={(e) => update(i, { lastName: e.target.value })} />
          <select style={cell} value={row.ageGroup} onChange={(e) => update(i, { ageGroup: e.target.value })}>
            {AGE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <input style={cell} value={row.startId} onChange={(e) => update(i, { startId: e.target.value })} />
          <input style={cell} value={row.endId} onChange={(e) => update(i, { endId: e.target.value })} />
          <input style={cell} value={row.result} onChange={(e) => update(i, { result: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

export function MatchForm({ match, onSaved, onCancel }: { match: Match; onSaved: (match: Match) => void; onCancel: () => void }) {
  const [homeShoots, setHomeShoots] = useState(() => toFormRows(match.shoots, "HOME", false, 4));
  const [guestShoots, setGuestShoots] = useState(() => toFormRows(match.shoots, "GUEST", false, 4));
  const [additionalHome, setAdditionalHome] = useState(() => toFormRows(match.shoots, "HOME", true, 0));
  const [additionalGuest, setAdditionalGuest] = useState(() => toFormRows(match.shoots, "GUEST", true, 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const saved = await api.saveMatch(match.id, {
        homeShoots: toApiRows(homeShoots),
        guestShoots: toApiRows(guestShoots),
        additionalHomeShoots: toApiRows(additionalHome),
        additionalGuestShoots: toApiRows(additionalGuest),
      });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 12, padding: 20, maxWidth: 720 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{match.homeTeam.name}</h3>
      <ShootRows rows={homeShoots} onChange={setHomeShoots} />
      <div style={{ fontSize: 12, fontWeight: 600, margin: "8px 0" }}>Zusätzliche Schützen/innen</div>
      <ShootRows rows={additionalHome} onChange={setAdditionalHome} />
      <button
        type="button"
        onClick={() => setAdditionalHome((prev) => [...prev, emptyRow()])}
        style={{ border: `1px solid ${theme.border}`, background: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", marginBottom: 20 }}
      >
        +
      </button>

      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{match.guestTeam.name}</h3>
      <ShootRows rows={guestShoots} onChange={setGuestShoots} />
      <div style={{ fontSize: 12, fontWeight: 600, margin: "8px 0" }}>Zusätzliche Schützen/innen</div>
      <ShootRows rows={additionalGuest} onChange={setAdditionalGuest} />
      <button
        type="button"
        onClick={() => setAdditionalGuest((prev) => [...prev, emptyRow()])}
        style={{ border: `1px solid ${theme.border}`, background: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", marginBottom: 20 }}
      >
        +
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
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ border: "none", background: theme.green, color: "#fff", borderRadius: 6, padding: "8px 16px", cursor: "pointer" }}
        >
          {saving ? "Speichert…" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
