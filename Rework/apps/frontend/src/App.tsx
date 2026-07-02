import { useEffect, useState } from "react";
import { api } from "./api/client";
import type { SeasonSummary } from "./types";
import { Sidebar } from "./components/Sidebar";
import { CreateSeasonForm } from "./components/CreateSeasonForm";
import { SeasonView } from "./components/SeasonView";
import { LoginGate } from "./components/LoginGate";
import { SplashScreen } from "./components/SplashScreen";
import { theme } from "./theme";

type View = { kind: "empty" } | { kind: "create" } | { kind: "season"; id: number };

export default function App() {
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [view, setView] = useState<View>({ kind: "empty" });
  const [showSplash, setShowSplash] = useState(true);

  function reloadSeasons() {
    api.getSeasons().then(setSeasons).catch(console.error);
  }

  useEffect(() => {
    reloadSeasons();
  }, []);

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <LoginGate>
        {({ user, onLogout }) => (
          <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "system-ui, sans-serif" }}>
            <Sidebar
              seasons={seasons}
              selectedId={view.kind === "season" ? view.id : null}
              onSelect={(id) => setView({ kind: "season", id })}
              onCreateClick={() => setView({ kind: "create" })}
              user={user}
              onLogout={onLogout}
            />
            <main style={{ flex: 1, padding: "24px 32px" }}>
              {view.kind === "empty" && <p style={{ color: theme.textMuted }}>Wähle eine Saison aus oder lege eine neue an.</p>}
              {view.kind === "create" && (
                <CreateSeasonForm
                  onCreated={(id) => {
                    reloadSeasons();
                    setView({ kind: "season", id });
                  }}
                  onCancel={() => setView({ kind: "empty" })}
                />
              )}
              {view.kind === "season" && <SeasonView seasonId={view.id} />}
            </main>
          </div>
        )}
      </LoginGate>
    </>
  );
}
