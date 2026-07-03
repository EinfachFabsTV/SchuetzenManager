import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuthUser } from "../api/client";
import type { Responsible, Team } from "../types";
import { theme } from "../theme";

const selectStyle: React.CSSProperties = {
  height: 34,
  padding: "0 8px",
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  fontSize: 13,
  background: theme.surfaceAlt,
  color: theme.text,
};

// Mirrors view/ResponsibleView.java: assign webservice users as responsible
// for individual teams of the season. Only meaningful with auth enabled
// (there are no users otherwise), so SeasonView only mounts this when a
// logged-in user is present.
export function ResponsibleTab({ seasonId, teams }: { seasonId: number; teams: Team[] }) {
  const [rows, setRows] = useState<Responsible[] | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [userId, setUserId] = useState<number | "">("");
  const [team, setTeam] = useState<string>(teams[0]?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  function reload() {
    api.getResponsible(seasonId).then(setRows).catch((err) => setError(err.message));
  }

  useEffect(() => {
    reload();
    api.getUsers().then(setUsers).catch(() => setUsers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId]);

  async function add() {
    setError(null);
    if (userId === "" || !team) return;
    try {
      await api.addResponsible(seasonId, Number(userId), team);
      setUserId("");
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      await api.deleteResponsible(id);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!rows) return <p style={{ fontSize: 13, color: theme.textMuted }}>Lädt…</p>;

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Verantwortliche (Webservice)</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <select value={userId} onChange={(e) => setUserId(e.target.value === "" ? "" : Number(e.target.value))} style={selectStyle}>
          <option value="">Benutzer wählen…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.realName} ({u.email})
            </option>
          ))}
        </select>
        <select value={team} onChange={(e) => setTeam(e.target.value)} style={selectStyle}>
          {teams.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          disabled={userId === "" || !team}
          style={{ border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
        >
          Zuordnen
        </button>
      </div>

      {error && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 10 }}>{error}</p>}

      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: theme.textMuted }}>Noch keine Zuordnungen.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: theme.textMuted, textAlign: "left" }}>
              <th style={{ padding: "6px 8px" }}>Benutzer</th>
              <th style={{ padding: "6px 8px" }}>Mannschaft</th>
              <th style={{ padding: "6px 8px" }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${theme.border}` }}>
                <td style={{ padding: "6px 8px" }}>
                  {r.realName} <span style={{ color: theme.textMuted }}>({r.email})</span>
                </td>
                <td style={{ padding: "6px 8px" }}>{r.team}</td>
                <td style={{ padding: "6px 8px" }}>
                  <button
                    onClick={() => remove(r.id)}
                    style={{ border: `1px solid ${theme.danger}`, background: "transparent", color: theme.danger, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}
                  >
                    Entfernen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
