import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuthUser } from "../api/client";
import { theme } from "../theme";
import { ChangePasswordForm } from "./ChangePasswordForm";

type Props = { user: AuthUser | null };

// Only present inside the Tauri desktop shell - the same frontend bundle
// also serves the central-hosting Docker deployment, which has no local
// vault at all (see api/client.ts's identical check).
function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

const cardStyle: React.CSSProperties = {
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 12,
  padding: 20,
  maxWidth: 480,
};

const inputStyle: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
  background: theme.surfaceAlt,
  color: theme.text,
};

export function SettingsPage({ user }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Einstellungen</h1>
      {isTauri() && <VaultPasswordSection />}
      {user && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: theme.text }}>Mein Account</h3>
          <ChangePasswordForm variant="inline" onClose={() => {}} />
        </div>
      )}
      {user && <UserManagementSection />}
    </div>
  );
}

function VaultPasswordSection() {
  const [currentSecret, setCurrentSecret] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    setSaving(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("vault_change_password", { currentSecret, newPassword });
      setSuccess(true);
      setCurrentSecret("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: theme.text }}>Tresor-Passwort ändern</h3>
      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
          Aktuelles Passwort oder Wiederherstellungscode
        </label>
        <input
          style={{ ...inputStyle, marginBottom: 12 }}
          type="password"
          value={currentSecret}
          onChange={(e) => setCurrentSecret(e.target.value)}
        />
        <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Neues Passwort</label>
        <input
          style={{ ...inputStyle, marginBottom: 12 }}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>
          Neues Passwort bestätigen
        </label>
        <input
          style={{ ...inputStyle, marginBottom: 16 }}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ color: theme.text, fontSize: 13, marginBottom: 12 }}>Tresor-Passwort wurde geändert.</p>}
        <button
          type="submit"
          disabled={saving}
          style={{ border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "10px 16px", cursor: "pointer", fontSize: 14 }}
        >
          {saving ? "Speichert…" : "Passwort ändern"}
        </button>
      </form>
    </div>
  );
}

function UserManagementSection() {
  const [users, setUsers] = useState<AuthUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [realName, setRealName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .getUsers()
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const created = await api.createUser(email, realName);
      setUsers((prev) => (prev ? [...prev, created] : [created]));
      setCreatedMessage("Ein Zugangslink wurde per E-Mail versendet.");
      setEmail("");
      setRealName("");
      setShowAdd(false);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: theme.text }}>Nutzerverwaltung</h3>
      {error && <p style={{ color: theme.danger, fontSize: 13 }}>{error}</p>}
      {users && users.length === 0 && <p style={{ fontSize: 13, color: theme.textMuted }}>Noch keine Nutzer.</p>}
      {users && users.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0" }}>
          {users.map((u) => (
            <li key={u.id} style={{ padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
              {u.realName} <span style={{ color: theme.textMuted }}>({u.email})</span>
            </li>
          ))}
        </ul>
      )}
      {createdMessage && <p style={{ fontSize: 13, color: theme.text, marginBottom: 12 }}>{createdMessage}</p>}
      {showAdd ? (
        <form onSubmit={handleCreate}>
          <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>E-Mail</label>
          <input style={{ ...inputStyle, marginBottom: 12 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Name</label>
          <input style={{ ...inputStyle, marginBottom: 12 }} value={realName} onChange={(e) => setRealName(e.target.value)} />
          {createError && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{createError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={creating}
              style={{ border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}
            >
              {creating ? "Lädt…" : "Anlegen"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}
        >
          + Nutzer hinzufügen
        </button>
      )}
    </div>
  );
}
