export type PersonalScoreMatch = {
  homeTeamId: number;
  guestTeamId: number;
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
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Mirrors Season.java#getPersonalScore()/removeZeroScores(): grouped by
// shooter name + team + age group, mean is total divided by the number of
// weeks with a non-zero result (not by the total number of weeks played),
// and shooters who never scored are dropped entirely.
export function computePersonalScores(
  matches: PersonalScoreMatch[],
  teamNamesById: Map<number, string>,
): PersonalScoreRow[] {
  const totals = new Map<string, { shooter: string; team: string; ageGroup: string; total: number; active: number }>();

  for (const match of matches) {
    for (const shoot of match.shoots) {
      const shooter = `${shoot.firstName} ${shoot.lastName}`.trim();
      const teamId = shoot.teamSide === "HOME" ? match.homeTeamId : match.guestTeamId;
      const team = teamNamesById.get(teamId) ?? "";
      const key = `${shoot.ageGroup}::${shooter}::${team}`;

      const entry = totals.get(key) ?? { shooter, team, ageGroup: shoot.ageGroup, total: 0, active: 0 };
      entry.total += shoot.result;
      if (shoot.result > 0) entry.active++;
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
    }))
    .sort((a, b) => b.total - a.total || b.mean - a.mean || a.shooter.localeCompare(b.shooter));
}
