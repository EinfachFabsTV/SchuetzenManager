// Guided product tour: a versioned list of steps plus the persistence that
// decides which of them to show.
//
// Steps are gated by CONTEXT, not just version. A step that explains the
// match entry screen is pointless on first launch, when no season exists yet
// and the user is staring at an empty page - so it waits until the user
// actually opens a season, then continues there. Each step optionally targets
// an element by its data-tour attribute; the overlay highlights it when
// present and falls back to a centered card when it isn't mounted, so a step
// can never block the tour.

// Where a step makes sense. "start" = the initial screen (no season open),
// "season" = a season is open, so its tabs and their controls exist.
export type TourContext = "start" | "season";

export type TourStep = {
  // Stable id, used to remember which steps the user has already seen.
  id: string;
  // data-tour attribute value of the element to highlight, or null for a
  // centered informational card.
  target: string | null;
  title: string;
  body: string;
  // Only runs when the app is in this context.
  requires: TourContext;
  // The tour version this step was introduced in. After an update, only steps
  // newer than what the user has already seen run as a short "what's new" tour.
  sinceVersion: number;
};

// Bump when adding steps for a new release; set new steps' sinceVersion to it.
export const TOUR_VERSION = 1;

const SEEN_KEY = "schuetzenmanager_tour_seen_version";
const DONE_KEY = "schuetzenmanager_tour_done_steps";

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "Willkommen beim SchützenManager",
    body: "Diese kurze Tour zeigt dir die wichtigsten Funktionen. Mit „Weiter“ gehst du Schritt für Schritt durch. Sobald du später eine Saison öffnest, geht die Tour dort weiter.",
    requires: "start",
    sinceVersion: 1,
  },
  {
    id: "new-season",
    target: "new-season",
    title: "Neue Saison anlegen",
    body: "Hier legst du eine neue Kreismeisterschaft an: Jahr, Bezeichnung und die Mannschaften. Der Spielplan mit Hin- und Rückrunde wird automatisch erzeugt.",
    requires: "start",
    sinceVersion: 1,
  },
  {
    id: "season-list",
    target: "season-list",
    title: "Deine Saisons",
    body: "Angelegte Saisons erscheinen hier. Ein Klick öffnet sie – dann geht die Tour mit den Bereichen einer Saison weiter.",
    requires: "start",
    sinceVersion: 1,
  },
  {
    id: "settings-nav",
    target: "settings-nav",
    title: "Einstellungen & Sicherheit",
    body: "Hier legst du den PDF-Kopf mit Logo fest, änderst dein Tresor-Passwort, kannst alte Daten wiederherstellen und diese Tour jederzeit erneut starten.",
    requires: "start",
    sinceVersion: 1,
  },
  // --- continues once a season is open -------------------------------
  {
    id: "season-sections",
    target: "season-sections",
    title: "Die Bereiche einer Saison",
    body: "Über diese Punkte erreichst du alles zur Saison: Übersicht und Mannschaften, die Wettkämpfe, die Einzelwertung, Termine sowie den PDF-Export.",
    requires: "season",
    sinceVersion: 1,
  },
  {
    id: "matches",
    target: "nav-Wettkämpfe",
    title: "Ergebnisse & Wettkämpfe",
    body: "Unter „Wettkämpfe“ öffnest du eine Begegnung und trägst die Ringe ein. Oben rechts schaltest du zwischen Wochen- und Hin-/Rückrunden-Ansicht um, und du kannst Begegnungen per Ziehen in eine andere Woche verschieben.",
    requires: "season",
    sinceVersion: 1,
  },
  {
    id: "dates",
    target: "nav-Termine & Info",
    title: "Termine festlegen",
    body: "Hier trägst du je Wettkampfwoche den Heimtag und optional einen zweiten Tag (Gasttag) ein. Beide erscheinen später im PDF-Spielplan.",
    requires: "season",
    sinceVersion: 1,
  },
  {
    id: "pdf",
    target: "nav-PDF-Export",
    title: "PDF-Export",
    body: "Erzeugt den Spielplan im gewohnten Layout – mit Kopfzeile und Logo aus den Einstellungen. Du wählst die Abschnitte und speicherst die Datei, wo du möchtest.",
    requires: "season",
    sinceVersion: 1,
  },
];

export function getSeenVersion(): number {
  const raw = localStorage.getItem(SEEN_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

function getDoneSteps(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Remembers a finished segment. Once every step is done, the whole tour
 *  counts as seen for this version and stops auto-running. */
export function markStepsDone(steps: TourStep[]): void {
  const done = new Set([...getDoneSteps(), ...steps.map((s) => s.id)]);
  localStorage.setItem(DONE_KEY, JSON.stringify([...done]));
  if (TOUR_STEPS.every((s) => done.has(s.id))) markTourSeen();
}

export function markTourSeen(version = TOUR_VERSION): void {
  localStorage.setItem(SEEN_KEY, String(version));
}

/** Clears all progress so the full tour runs again (Settings → Tour wiederholen). */
export function resetTourProgress(): void {
  localStorage.removeItem(SEEN_KEY);
  localStorage.removeItem(DONE_KEY);
}

/**
 * Steps to auto-run right now: new enough (version), not yet seen, and
 * applicable to the current context. That's what keeps the season-specific
 * steps from firing on an empty first-launch screen - they run later, when
 * the user opens a season and can actually see what's being explained.
 */
export function stepsToAutoRun(context: TourContext, seen = getSeenVersion(), done = getDoneSteps()): TourStep[] {
  return TOUR_STEPS.filter((s) => s.sinceVersion > seen && s.requires === context && !done.includes(s.id));
}
