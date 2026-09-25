import { computeMatchScore } from "./matchScore.js";
import { round1 } from "./numbers.js";

export type WeekResultMatch = {
  week: number;
  homeTeamId: number;
  guestTeamId: number;
  shoots: { teamSide: string; additional: boolean; result: number }[];
};

export type WeekResultRow = {
  homeTeam: string;
  homeScore: number;
  guestTeam: string;
  guestScore: number;
};

/**
 * Begegnungen einer Wettkampfwoche mit beiden Mannschaftsergebnissen –
 * Grundlage für den Wochenbericht im PDF (Heim | Ergebnis | Gast | Ergebnis).
 *
 * Das Mannschaftsergebnis entsteht wie überall aus den besten drei der vier
 * regulären Schützen (computeMatchScore); Zusatzschützen zählen nicht mit.
 * Noch nicht erfasste Begegnungen erscheinen mit 0, damit der Spielplan der
 * Woche vollständig bleibt.
 */
export function computeWeekResults(
  matches: WeekResultMatch[],
  teamNamesById: Map<number, string>,
  week: number,
): WeekResultRow[] {
  const primary = (match: WeekResultMatch, side: string) =>
    match.shoots.filter((s) => !s.additional && s.teamSide === side).map((s) => s.result);

  return matches
    .filter((m) => m.week === week)
    .map((m) => ({
      homeTeam: teamNamesById.get(m.homeTeamId) ?? "",
      homeScore: round1(computeMatchScore(primary(m, "HOME"))),
      guestTeam: teamNamesById.get(m.guestTeamId) ?? "",
      guestScore: round1(computeMatchScore(primary(m, "GUEST"))),
    }))
    .sort((a, b) => a.homeTeam.localeCompare(b.homeTeam));
}
