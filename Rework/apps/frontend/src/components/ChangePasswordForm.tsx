import { useState } from "react";
import { api } from "../api/client";
import { theme } from "../theme";

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

type Props = {
  onClose: () => void;
  // "modal" (default) is the original fixed-backdrop popup, used from
  // Sidebar. "inline" renders as a plain section - for embedding directly
  // in SettingsPage, which is the "real" entry point now.
  variant?: "modal" | "inline";
};

export function ChangePasswordForm({ onClose, variant = "modal" }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const formContent = (
    <form
      onSubmit={handleSubmit}
      onClick={variant === "modal" ? (e) => e.stopPropagation() : undefined}
      style={variant === "modal" ? { width: 320, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24 } : { width: "100%", maxWidth: 400 }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: theme.text }}>Passwort ändern</h3>

      {success ? (
        <>
          <p style={{ fontSize: 13, color: theme.text, marginBottom: 16 }}>Passwort wurde geändert.</p>
          {variant === "modal" && (
            <button
              type="button"
              onClick={onClose}
              style={{ width: "100%", border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "10px 0", cursor: "pointer", fontSize: 14 }}
            >
              Schließen
            </button>
          )}
        </>
      ) : (
        <>
          <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Aktuelles Passwort</label>
          <input
            style={{ ...inputStyle, marginBottom: 12 }}
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Neues Passwort</label>
          <input
            style={{ ...inputStyle, marginBottom: 12 }}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Neues Passwort bestätigen</label>
          <input
            style={{ ...inputStyle, marginBottom: 16 }}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <div style={{ display: "flex", gap: 8 }}>
            {variant === "modal" && (
              <button
                type="button"
                onClick={onClose}
                style={{ flex: 1, border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, borderRadius: 6, padding: "10px 0", cursor: "pointer", fontSize: 14 }}
              >
                Abbrechen
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              style={{ flex: 1, border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "10px 0", cursor: "pointer", fontSize: 14 }}
            >
              {saving ? "Speichert…" : "Speichern"}
            </button>
          </div>
        </>
      )}
    </form>
  );

  if (variant === "inline") {
    return formContent;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      {formContent}
    </div>
  );
}
