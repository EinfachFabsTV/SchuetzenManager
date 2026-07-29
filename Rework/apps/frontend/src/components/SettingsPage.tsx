import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuthUser } from "../api/client";
import { theme } from "../theme";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { VaultResetPanel } from "./VaultResetPanel";

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
      <PdfHeaderSection />
      {isTauri() && <VaultPasswordSection />}
      {user && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: theme.text }}>Mein Account</h3>
          <ChangePasswordForm variant="inline" onClose={() => {}} />
        </div>
      )}
      {user && <UserManagementSection />}
      {isTauri() && (
        <div style={{ ...cardStyle, borderColor: theme.danger }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: theme.danger }}>Gefahrenzone</h3>
          <p style={{ fontSize: 13, color: theme.textMuted, margin: 0 }}>
            Setzt den Tresor zurück und startet die Ersteinrichtung neu. Die bisherigen Daten werden dabei
            verschlüsselt in einen Sicherungsordner verschoben.
          </p>
          {/* vault_reset stops the backend sidecar, so there is no usable
              app state left to return to - reloading sends the whole UI
              back through VaultGate, which now finds no vault and starts
              first-run setup. */}
          <VaultResetPanel onReset={() => window.location.reload()} />
        </div>
      )}
    </div>
  );
}

// Reads a picked image file as a base64 data URL for upload. The bytes are
// stored in the DB server-side, so the original file/folder can be deleted.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

// Global default PDF header (club name, website, logo). A season can override
// these at creation; otherwise every PDF uses what's set here.
function PdfHeaderSection() {
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [hasLogo, setHasLogo] = useState(false);
  // undefined = unchanged, null = remove, string = new base64 logo.
  const [newLogo, setNewLogo] = useState<string | null | undefined>(undefined);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getSettings()
      .then((s) => {
        setLine1(s.headerLine1 ?? "");
        setLine2(s.headerLine2 ?? "");
        setHasLogo(s.hasLogo);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    try {
      setNewLogo(await fileToDataUrl(file));
      setLogoName(file.name);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function save() {
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const result = await api.updateSettings({
        headerLine1: line1 || null,
        headerLine2: line2 || null,
        ...(newLogo !== undefined ? { logo: newLogo } : {}),
      });
      setHasLogo(result.hasLogo);
      setNewLogo(undefined);
      setLogoName(null);
      setMessage("Gespeichert.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: theme.textMuted };

  return (
    <div style={cardStyle}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: theme.text }}>PDF-Kopf</h3>
      <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 0, marginBottom: 16 }}>
        Erscheint oben auf jedem exportierten PDF. Beim Anlegen einer Saison kann davon abgewichen werden.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={label}>
          Zeile 1 (z.B. Vereinsname)
          <input value={line1} onChange={(e) => setLine1(e.target.value)} style={inputStyle} />
        </label>
        <label style={label}>
          Zeile 2 (z.B. Website)
          <input value={line2} onChange={(e) => setLine2(e.target.value)} style={inputStyle} />
        </label>
        <label style={label}>
          Logo
          <input type="file" accept="image/png,image/jpeg" onChange={(e) => handleFile(e.target.files?.[0])} style={{ fontSize: 12, color: theme.text }} />
        </label>
        <div style={{ fontSize: 12, color: theme.textMuted }}>
          {newLogo === null
            ? "Logo wird beim Speichern entfernt."
            : logoName
              ? `Neues Logo: ${logoName}`
              : hasLogo
                ? "Ein Logo ist hinterlegt."
                : "Kein Logo hinterlegt."}
          {(hasLogo || newLogo) && newLogo !== null && (
            <button type="button" onClick={() => { setNewLogo(null); setLogoName(null); }} style={{ marginLeft: 10, border: "none", background: "none", color: theme.danger, fontSize: 12, textDecoration: "underline", cursor: "pointer", padding: 0 }}>
              entfernen
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ color: theme.danger, fontSize: 13, marginTop: 10 }}>{error}</p>}
      {message && <p style={{ color: theme.green, fontSize: 13, marginTop: 10 }}>{message}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        style={{ marginTop: 14, border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
      >
        {saving ? "Speichert…" : "Speichern"}
      </button>
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
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .getUsers()
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, []);

  async function handleReset(u: AuthUser) {
    setActionMessage(null);
    try {
      await api.resetUserPassword(u.id);
      setActionMessage(`Neues Passwort für ${u.realName} per E-Mail versendet.`);
    } catch (err) {
      setActionMessage((err as Error).message);
    }
  }

  async function handleDelete(u: AuthUser) {
    setActionMessage(null);
    if (!window.confirm(`Benutzer ${u.realName} (${u.email}) löschen?`)) return;
    try {
      await api.deleteUser(u.id);
      setUsers((prev) => (prev ? prev.filter((x) => x.id !== u.id) : prev));
    } catch (err) {
      setActionMessage((err as Error).message);
    }
  }

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
            <li key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
              <span style={{ flex: 1 }}>
                {u.realName} <span style={{ color: theme.textMuted }}>({u.email})</span>
              </span>
              <button
                type="button"
                onClick={() => handleReset(u)}
                style={{ border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
              >
                Passwort zurücksetzen
              </button>
              <button
                type="button"
                onClick={() => handleDelete(u)}
                style={{ border: `1px solid ${theme.danger}`, background: "transparent", color: theme.danger, borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}
      {actionMessage && <p style={{ fontSize: 13, color: theme.text, marginBottom: 12 }}>{actionMessage}</p>}
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
