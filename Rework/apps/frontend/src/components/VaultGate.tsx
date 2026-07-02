import { useEffect, useState } from "react";
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

const buttonStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: theme.green,
  color: theme.onAccent,
  borderRadius: 6,
  padding: "10px 0",
  cursor: "pointer",
  fontSize: 14,
};

function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: theme.bg, color: theme.text }}>
      <div style={{ width: 360, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <img src="/logo.svg" alt="" width={32} height={32} />
          <strong style={{ color: theme.green, fontSize: 15 }}>SchützenManager</strong>
        </div>
        <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

// Only present inside the Tauri desktop shell - the same frontend bundle
// also serves the central-hosting Docker deployment (see api/client.ts's
// identical check), which has no local database to encrypt and must
// render children immediately.
function isTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

type Status = "checking" | "setup" | "locked" | "unlocked";

export function VaultGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>(isTauri() ? "checking" : "unlocked");

  useEffect(() => {
    if (!isTauri()) return;
    import("@tauri-apps/api/core").then(({ invoke }) =>
      invoke<"no_vault" | "locked">("vault_status")
        .then((result) => setStatus(result === "no_vault" ? "setup" : "locked"))
        .catch(() => setStatus("locked")),
    );
  }, []);

  if (status === "checking") {
    return <p style={{ padding: 24, color: theme.textMuted }}>Lädt…</p>;
  }
  if (status === "setup") {
    return <SetupScreen onUnlocked={() => setStatus("unlocked")} />;
  }
  if (status === "locked") {
    return <UnlockScreen onUnlocked={() => setStatus("unlocked")} />;
  }
  return <>{children}</>;
}

function SetupScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [confirmedSaved, setConfirmedSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setSaving(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const code = await invoke<string>("vault_setup", { password });
      setRecoveryCode(code);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (recoveryCode) {
    return (
      <Screen title="Wiederherstellungscode speichern">
        <p style={{ fontSize: 13, color: theme.text, marginBottom: 12 }}>
          Mit diesem Code kommst du an deine Daten, falls du dein Passwort vergisst. Er wird nur dieses eine Mal
          angezeigt - speichere ihn jetzt an einem sicheren Ort.
        </p>
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 15,
            letterSpacing: 1,
            background: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: 6,
            padding: "10px 12px",
            marginBottom: 16,
            wordBreak: "break-all",
            textAlign: "center",
          }}
        >
          {recoveryCode}
        </p>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: theme.text, marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={confirmedSaved} onChange={(e) => setConfirmedSaved(e.target.checked)} style={{ marginTop: 2 }} />
          Ich habe den Wiederherstellungscode gespeichert.
        </label>
        <button type="button" onClick={onUnlocked} disabled={!confirmedSaved} style={{ ...buttonStyle, opacity: confirmedSaved ? 1 : 0.5, cursor: confirmedSaved ? "pointer" : "not-allowed" }}>
          Weiter
        </button>
      </Screen>
    );
  }

  return (
    <Screen title="Passwort festlegen">
      <form onSubmit={handleSubmit}>
        <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>
          Beim ersten Start wird deine lokale Datenbank mit einem Passwort verschlüsselt.
        </p>
        <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Passwort</label>
        <input style={{ ...inputStyle, marginBottom: 12 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Passwort bestätigen</label>
        <input style={{ ...inputStyle, marginBottom: 16 }} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        {error && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={saving} style={buttonStyle}>
          {saving ? "Richte Tresor ein…" : "Passwort festlegen"}
        </button>
      </form>
    </Screen>
  );
}

function UnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setUnlocking(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("vault_unlock", { secret });
      onUnlocked();
    } catch (err) {
      setError(String(err));
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <Screen title="Entsperren">
      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Passwort oder Wiederherstellungscode</label>
        <input style={{ ...inputStyle, marginBottom: 16 }} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
        {error && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={unlocking} style={buttonStyle}>
          {unlocking ? "Entsperre…" : "Entsperren"}
        </button>
      </form>
    </Screen>
  );
}
