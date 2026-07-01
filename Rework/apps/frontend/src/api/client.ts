import type { Match, PersonalScoreRow, SeasonDetail, SeasonSummary, TableRow } from "../types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API-Fehler ${res.status}`);
  }
  return res.json();
}

export type NewTeamInput = {
  name: string;
  trainingDay?: string;
  trainingTime?: string;
  location?: string;
  contact?: string;
  phone?: string;
};

export const api = {
  getSeasons: () => request<SeasonSummary[]>("/seasons"),
  createSeason: (data: { year: number; label: string; teams: NewTeamInput[] }) =>
    request<SeasonDetail>("/seasons", { method: "POST", body: JSON.stringify(data) }),
  getSeason: (id: number) => request<SeasonDetail>(`/seasons/${id}`),
  getTable: (id: number) => request<TableRow[]>(`/seasons/${id}/table`),
  getPersonalScores: (id: number) => request<PersonalScoreRow[]>(`/seasons/${id}/personal-scores`),
  saveMatch: (
    id: number,
    data: {
      homeShoots: ShootFormRow[];
      guestShoots: ShootFormRow[];
      additionalHomeShoots?: ShootFormRow[];
      additionalGuestShoots?: ShootFormRow[];
    },
  ) => request<Match>(`/matches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

export type ShootFormRow = {
  firstName: string;
  lastName: string;
  ageGroup: string;
  startId: number | null;
  endId: number | null;
  result: number;
};
