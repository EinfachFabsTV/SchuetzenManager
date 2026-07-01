import { useEffect, useState } from "react";
import { api, getToken, setToken } from "../api/client";
import type { AuthUser } from "../api/client";
import { LoginForm } from "./LoginForm";
import { theme } from "../theme";

type Status = "loading" | "disabled" | "needsLogin" | "authed";

export function LoginGate({ children }: { children: (props: { user: AuthUser | null; onLogout: () => void }) => React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    api
      .getAuthStatus()
      .then(async ({ enabled }) => {
        if (!enabled) {
          setStatus("disabled");
          return;
        }
        if (!getToken()) {
          setStatus("needsLogin");
          return;
        }
        try {
          const me = await api.getMe();
          if (me) {
            setUser(me);
            setStatus("authed");
          } else {
            setToken(null);
            setStatus("needsLogin");
          }
        } catch {
          setToken(null);
          setStatus("needsLogin");
        }
      })
      .catch(() => setStatus("disabled"));
  }, []);

  function handleLogout() {
    setToken(null);
    setUser(null);
    setStatus("needsLogin");
  }

  if (status === "loading") {
    return <p style={{ padding: 24, color: theme.textMuted }}>Lädt…</p>;
  }
  if (status === "needsLogin") {
    return (
      <LoginForm
        onSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setStatus("authed");
        }}
      />
    );
  }
  return <>{children({ user, onLogout: handleLogout })}</>;
}
