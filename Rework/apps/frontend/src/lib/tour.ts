// Guided product tour: a versioned list of steps plus the persistence that
// decides which of them to show. Each step optionally targets an element by
// its data-tour attribute; the Tour overlay highlights it when present and
// falls back to a centered card when it isn't mounted, so a step can never
// block the tour.

export type TourStep = {
  // data-tour attribute value of the element to highlight, or null for a
  // centered informational card.
  target: string | null;
  title: string;
  body: string;
  // The tour version this step was introduced in. After an update, only steps
  // newer than what the user has already seen run as a short "what's new" tour.
  sinceVersion: number;
};

// Bump when adding steps for a new release; set new steps' sinceVersion to it.
export const TOUR_VERSION = 1;

const SEEN_KEY = "schuetzenmanager_tour_seen_version";

export const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: "Willkommen beim SchützenManager",
    body: "Diese kurze Tour zeigt dir die wichtigsten Funktionen. Mit „Weiter“ gehst du Schritt für Schritt durch – am Ende kannst du gleich loslegen.",
    sinceVersion: 1,
  },
  {
    target: "new-season",
    title: "Neue Saison anlegen",
    body: "Hier legst du eine neue Kreismeisterschaft an: Jahr, Bezeichnung und die Mannschaften. Der Spielplan (Hin- und Rückrunde) wird automatisch erzeugt.",
    sinceVersion: 1,
  },
  {
    target: "season-list",
    title: "Deine Saisons",
    body: "Angelegte Saisons erscheinen hier. Ein Klick öffnet sie mit den Bereichen Übersicht, Wettkämpfe, Schützen und mehr.",
    sinceVersion: 1,
  },
  {
    target: null,
    title: "Ergebnisse & Wettkämpfe",
    body: "Im Bereich „Wettkämpfe“ öffnest du ein Match und trägst die Ringe ein. Oben rechts schaltest du zwischen Wochen- und Hin-/Rückrunden-Ansicht um, und du kannst Begegnungen per Ziehen in eine andere Woche verschieben.",
    sinceVersion: 1,
  },
  {
    target: null,
    title: "Termine, Mannschaften & PDF",
    body: "Unter „Termine & Info“ pflegst du Heim- und Gasttage, unter „Übersicht“ die Mannschaftsdaten. Über „PDF-Export“ erzeugst du den Spielplan im gewohnten Layout – der Kopf (Verein, Logo) kommt aus den Einstellungen.",
    sinceVersion: 1,
  },
  {
    target: "settings-nav",
    title: "Einstellungen & Sicherheit",
    body: "Hier legst du den PDF-Kopf mit Logo fest, änderst dein Tresor-Passwort, kannst alte Daten wiederherstellen und diese Tour jederzeit erneut starten.",
    sinceVersion: 1,
  },
];

export function getSeenVersion(): number {
  const raw = localStorage.getItem(SEEN_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function markTourSeen(version = TOUR_VERSION): void {
  localStorage.setItem(SEEN_KEY, String(version));
}

// Auto-run steps: everything newer than what the user has already seen. On a
// first launch (seen = 0) that's the whole tour; after an update only the new
// steps. Replaying from Settings passes all steps directly instead.
export function stepsToAutoRun(seen = getSeenVersion()): TourStep[] {
  return TOUR_STEPS.filter((s) => s.sinceVersion > seen);
}
