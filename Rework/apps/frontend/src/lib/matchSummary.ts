import type { Match } from "../types";

/** 4 Schützen je Mannschaft – die Zahl hinter dem "/" im Erfassungsstand. */
export const SHOOTS_PER_MATCH = 8;

/** Ampel für den Erfassungsstand: vollständig, fast fertig, oder es fehlt zu viel. */
export type MatchTone = "complete" | "almost" | "incomplete";

export type MatchSummary = {
  recorded: number;
  missing: number;
  tone: MatchTone;
  label: string;
  /** Ringe der Heimmannschaft: Summe aller regulären Schützen dieses Tages. */
  homeRings: number;
  guestRings: number;
};

export function summarizeMatch(match: Match): MatchSummary {
  // Ersatzschützen bleiben außen vor – sie zählen auch im Erfassungsstand
  // daneben nicht mit, sonst stünden Zähler und Ringe für verschiedene Sätze.
  const regular = match.shoots.filter((s) => !s.additional);
  const sumOf = (side: "HOME" | "GUEST") =>
    regular.filter((s) => s.teamSide === side).reduce((sum, s) => sum + s.result, 0);

  const recorded = regular.length;
  const missing = Math.max(SHOOTS_PER_MATCH - recorded, 0);

  return {
    recorded,
    missing,
    // Bis zu zwei fehlende Ergebnisse sind Alltag (Nachtrag), darüber hinaus
    // fehlt in der Regel eine ganze Mannschaft.
    tone: missing === 0 ? "complete" : missing <= 2 ? "almost" : "incomplete",
    label: recorded === 0 ? "offen" : `${recorded}/${SHOOTS_PER_MATCH} erfasst`,
    homeRings: sumOf("HOME"),
    guestRings: sumOf("GUEST"),
  };
}

/** "1.860 / 1.291" – oder null, solange nichts erfasst ist. */
export function formatMatchRings(summary: MatchSummary): string | null {
  if (summary.recorded === 0) return null;
  const de = (n: number) => n.toLocaleString("de-DE");
  return `${de(summary.homeRings)} / ${de(summary.guestRings)}`;
}
