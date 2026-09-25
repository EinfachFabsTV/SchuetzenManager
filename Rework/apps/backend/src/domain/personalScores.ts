import { round1 } from "./numbers.js";

export type PersonalScoreMatch = {
  homeTeamId: number;
  guestTeamId: number;
  /** Wettkampfwoche des Matches – für die Wochenspalten im PDF. */
  week?: number;
  shoots: {
    teamSide: string;
    firstName: string;
    lastName: string;
    ageGroup: string;
    result: number;
  }[];
};

export type PersonalScoreRow = {
  shooter: string;
  team: string;
  ageGroup: string;
  total: number;
  mean: number;
  /**
   * Ergebnis je Wettkampfwoche, Index 0 = Woche 1. Wochen ohne Einsatz sind
   * null, damit die Vorlage dort eine Lücke zeigt statt einer 0.
   */
  byWeek: (number | null)[];
};

// Mirrors Season.java#getPersonalScore()/removeZeroScores(): grouped by
// shooter name + team + age group, mean is total divided by the number of
// weeks with a non-zero result (not by the total number of weeks played),
// and shooters who never scored are dropped entirely.
export function computePersonalScores(
  matches: PersonalScoreMatch[],
  teamNamesById: Map<number, string>,
): PersonalScoreRow[] {
  type Entry = {
    shooter: string;
    team: string;
    ageGroup: string;
    total: number;
    active: number;
    byWeek: Map<number, number>;
  };
  const totals = new Map<string, Entry>();
  let maxWeek = 0;

  for (const match of matches) {
    const week = match.week ?? 0;
    if (week > maxWeek) maxWeek = week;

    for (const shoot of match.shoots) {
      const shooter = `${shoot.firstName} ${shoot.lastName}`.trim();
      const teamId = shoot.teamSide === "HOME" ? match.homeTeamId : match.guestTeamId;
      const team = teamNamesById.get(teamId) ?? "";
      const key = `${shoot.ageGroup}::${shooter}::${team}`;

      const entry =
        totals.get(key) ?? { shooter, team, ageGroup: shoot.ageGroup, total: 0, active: 0, byWeek: new Map() };
      entry.total = round1(entry.total + shoot.result);
      if (shoot.result > 0) {
        entry.active++;
        if (week > 0) {
          // Mehrere Starts derselben Person in einer Woche (Zusatzschützen)
          // werden addiert, damit die Wochenspalte zur Summe passt.
          entry.byWeek.set(week, round1((entry.byWeek.get(week) ?? 0) + shoot.result));
        }
      }
      totals.set(key, entry);
    }
  }

  return [...totals.values()]
    .filter((entry) => entry.total > 0)
    .map((entry) => ({
      shooter: entry.shooter,
      team: entry.team,
      ageGroup: entry.ageGroup,
      total: entry.total,
      mean: entry.active > 0 ? round1(entry.total / entry.active) : 0,
      byWeek: Array.from({ length: maxWeek }, (_, i) => entry.byWeek.get(i + 1) ?? null),
    }))
    .sort((a, b) => b.total - a.total || b.mean - a.mean || a.shooter.localeCompare(b.shooter));
}
