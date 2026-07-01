export type SeasonSummary = {
  id: number;
  year: number;
  label: string;
};

export type Team = {
  id: number;
  name: string;
  trainingDay: string | null;
  trainingTime: string | null;
  location: string | null;
  contact: string | null;
  phone: string | null;
  seasonId: number;
};

export type Shoot = {
  id: number;
  firstName: string;
  lastName: string;
  ageGroup: string;
  teamSide: "HOME" | "GUEST";
  additional: boolean;
  startId: number | null;
  endId: number | null;
  result: number;
  matchId: number;
};

export type Match = {
  id: number;
  week: number;
  seasonId: number;
  homeTeamId: number;
  guestTeamId: number;
  homeTeam: Team;
  guestTeam: Team;
  shoots: Shoot[];
};

export type MatchDate = {
  id: number;
  week: number;
  date: string | null;
  seasonId: number;
};

export type SeasonDetail = SeasonSummary & {
  infoBox: string | null;
  contactMail: string | null;
  contactPerson: string | null;
  teams: Team[];
  matches: Match[];
  matchDates: MatchDate[];
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

export type PersonalScoreRow = {
  shooter: string;
  team: string;
  ageGroup: string;
  total: number;
  mean: number;
};

export const AGE_GROUPS = ["Schützenklasse", "Senioren"] as const;
