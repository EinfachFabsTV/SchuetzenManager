import { useEffect, useState } from "react";
import { api } from "./api/client";
import type { SeasonSummary } from "./types";
import { Sidebar } from "./components/Sidebar";
import { CreateSeasonForm } from "./components/CreateSeasonForm";
import { SeasonView } from "./components/SeasonView";
import { LoginGate } from "./components/LoginGate";
import { SplashScreen } from "./components/SplashScreen";
import { SettingsPage } from "./components/SettingsPage";
import { UpdateNotice } from "./components/UpdateNotice";
import { Tour } from "./components/Tour";
import { TOUR_STEPS, stepsToAutoRun, markTourSeen, type TourStep } from "./lib/tour";
import { theme } from "./theme";

type View = { kind: "empty" } | { kind: "create" } | { kind: "season"; id: number } | { kind: "settings" };

export default function App() {
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [view, setView] = useState<View>({ kind: "empty" });
  const [section, setSection] = useState("Übersicht");
  const [showSplash, setShowSplash] = useState(true);
  const [tourSteps, setTourSteps] = useState<TourStep[] | null>(null);

  // Auto-run the tour once the splash is gone (targets are mounted by then):
  // the whole tour on first launch, only new steps after an update. A replay
  // from Settings dispatches "sm:start-tour" to show everything again.
  useEffect(() => {
    if (showSplash) return;
    const steps = stepsToAutoRun();
    if (steps.length > 0) setTourSteps(steps);
  }, [showSplash]);

  useEffect(() => {
    const replay = () => setTourSteps(TOUR_STEPS);
    window.addEventListener("sm:start-tour", replay);
    return () => window.removeEventListener("sm:start-tour", replay);
  }, []);

  function openSeason(id: number) {
    setView({ kind: "season", id });
    setSection("Übersicht");
  }

  function reloadSeasons() {
    api.getSeasons().then(setSeasons).catch(console.error);
  }

  useEffect(() => {
    reloadSeasons();
  }, []);

  return (
    <>
      <UpdateNotice />
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <LoginGate>
        {({ user, onLogout }) => (
          <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "system-ui, sans-serif" }}>
            <Sidebar
              seasons={seasons}
              selectedId={view.kind === "season" ? view.id : null}
              activeSection={section}
              onSelect={openSeason}
              onSectionSelect={setSection}
              onCreateClick={() => setView({ kind: "create" })}
              onSettingsClick={() => setView({ kind: "settings" })}
              isSettingsActive={view.kind === "settings"}
              user={user}
              onLogout={onLogout}
            />
            <main style={{ flex: 1, minWidth: 0, padding: "24px 32px" }}>
              {view.kind === "empty" && <p style={{ color: theme.textMuted }}>Wähle eine Saison aus oder lege eine neue an.</p>}
              {view.kind === "create" && (
                <CreateSeasonForm
                  onCreated={(id) => {
                    reloadSeasons();
                    openSeason(id);
                  }}
                  onCancel={() => setView({ kind: "empty" })}
                />
              )}
              {view.kind === "season" && (
                <SeasonView
                  seasonId={view.id}
                  section={section}
                  user={user}
                  onNavigate={setSection}
                  onDeleted={() => {
                    reloadSeasons();
                    setView({ kind: "empty" });
                  }}
                />
              )}
              {view.kind === "settings" && <SettingsPage user={user} />}
            </main>
            {tourSteps && (
              <Tour
                steps={tourSteps}
                onFinish={() => {
                  markTourSeen();
                  setTourSteps(null);
                }}
              />
            )}
          </div>
        )}
      </LoginGate>
    </>
  );
}
