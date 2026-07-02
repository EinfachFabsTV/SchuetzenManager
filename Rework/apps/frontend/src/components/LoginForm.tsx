import { useState } from "react";
import { api, setToken } from "../api/client";
import type { AuthUser } from "../api/client";
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

export function LoginForm({ onSuccess }: { onSuccess: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [realName, setRealName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response =
        mode === "login" ? await api.login(email, password) : await api.registerFirstAdmin(email, realName, password);
      setToken(response.token);
      onSuccess(response.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: theme.bg, color: theme.text }}>
      <form onSubmit={handleSubmit} style={{ width: 320, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <img src="/logo.svg" alt="" width={32} height={32} />
          <strong style={{ color: theme.green, fontSize: 15 }}>SchützenManager</strong>
        </div>
        <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          {mode === "login" ? "Anmelden" : "Ersten Account anlegen"}
        </h1>

        <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>E-Mail</label>
        <input style={{ ...inputStyle, marginBottom: 12 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        {mode === "register" && (
          <>
            <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Name</label>
            <input style={{ ...inputStyle, marginBottom: 12 }} value={realName} onChange={(e) => setRealName(e.target.value)} />
          </>
        )}

        <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Passwort</label>
        <input
          style={{ ...inputStyle, marginBottom: 16 }}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", border: "none", background: theme.green, color: theme.onAccent, borderRadius: 6, padding: "10px 0", cursor: "pointer", fontSize: 14, marginBottom: 12 }}
        >
          {loading ? "Bitte warten…" : mode === "login" ? "Anmelden" : "Account anlegen"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{ width: "100%", border: "none", background: "transparent", color: theme.textMuted, cursor: "pointer", fontSize: 12 }}
        >
          {mode === "login" ? "Noch kein Account? Ersten Account anlegen" : "Bereits ein Account? Anmelden"}
        </button>
      </form>
    </div>
  );
}
