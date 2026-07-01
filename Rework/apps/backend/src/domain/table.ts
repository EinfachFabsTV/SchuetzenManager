import { computeMatchScore } from "./matchScore.js";

export type TableTeam = { id: number; name: string };
export type TableMatch = {
  homeTeamId: number;
  guestTeamId: number;
  shoots: { teamSide: string; additional: boolean; result: number }[];
};

export type TableRow = {
  teamId: number;
  team: string;
  win: number;
  loose: number;
  tied: number;
  rings: number;
  points: number;
};

// Mirrors Season.java#addMatch()/getMatchScoreListener(): a match affects
// the table as soon as either side has a non-zero score - it does not wait
// for both sides to be fully entered.
export function computeTable(teams: TableTeam[], matches: TableMatch[]): TableRow[] {
  const rows = new Map<number, TableRow>(
    teams.map((team) => [
      team.id,
      { teamId: team.id, team: team.name, win: 0, loose: 0, tied: 0, rings: 0, points: 0 },
    ]),
  );

  for (const match of matches) {
    const homeRow = rows.get(match.homeTeamId);
    const guestRow = rows.get(match.guestTeamId);
    if (!homeRow || !guestRow) continue;

    const primary = (side: string) =>
      match.shoots.filter((s) => !s.additional && s.teamSide === side).map((s) => s.result);
    const homeScore = computeMatchScore(primary("HOME"));
    const guestScore = computeMatchScore(primary("GUEST"));
    if (homeScore <= 0 && guestScore <= 0) continue;

    homeRow.rings += homeScore;
    guestRow.rings += guestScore;

    if (homeScore > guestScore) {
      homeRow.win++;
      guestRow.loose++;
      homeRow.points += 2;
    } else if (homeScore === guestScore) {
      homeRow.tied++;
      guestRow.tied++;
      homeRow.points += 1;
      guestRow.points += 1;
    } else {
      guestRow.win++;
      homeRow.loose++;
      guestRow.points += 2;
    }
  }

  // Mirrors TableRow.java#compareTo(): points desc, then rings desc, then team name asc.
  return [...rows.values()].sort((a, b) => b.points - a.points || b.rings - a.rings || a.team.localeCompare(b.team));
}
