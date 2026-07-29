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
import { TOUR_STEPS, stepsToAutoRun, markStepsDone, resetTourProgress, type TourStep } from "./lib/tour";
import { theme } from "./theme";

type View = { kind: "empty" } | { kind: "create" } | { kind: "season"; id: number } | { kind: "settings" };

export default function App() {
  const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
  const [view, setView] = useState<View>({ kind: "empty" });
  const [section, setSection] = useState("Übersicht");
  const [showSplash, setShowSplash] = useState(true);
  const [tourSteps, setTourSteps] = useState<TourStep[] | null>(null);

  // The tour runs in context-matched segments, so it never explains something
  // that isn't on screen: the "start" steps once the splash is gone, and the
  // season steps only when a season is actually open. Progress is remembered
  // per step, so opening a season later simply continues where it left off.
  const tourContext = view.kind === "season" ? "season" : "start";
  useEffect(() => {
    if (showSplash || tourSteps) return;
    const steps = stepsToAutoRun(tourContext);
    // Give the newly rendered section a tick to mount its data-tour targets.
    if (steps.length > 0) {
      const t = setTimeout(() => setTourSteps(steps), 150);
      return () => clearTimeout(t);
    }
  }, [showSplash, tourContext, tourSteps]);

  useEffect(() => {
    // Replay from Settings: clear progress and show every step of the
    // current context, so the user sees a coherent run rather than leftovers.
    const replay = () => {
      resetTourProgress();
      setTourSteps(TOUR_STEPS.filter((s) => s.requires === (view.kind === "season" ? "season" : "start")));
    };
    window.addEventListener("sm:start-tour", replay);
    return () => window.removeEventListener("sm:start-tour", replay);
  }, [view.kind]);

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
                  markStepsDone(tourSteps);
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
