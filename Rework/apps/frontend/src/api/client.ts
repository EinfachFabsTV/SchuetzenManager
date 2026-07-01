import type { Match, PersonalScoreRow, SeasonDetail, SeasonSummary, TableRow, Team } from "../types";

const TOKEN_KEY = "schuetzenmanager_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

export type AuthUser = { id: number; email: string; realName: string };
export type AuthResponse = { token: string; user: AuthUser };

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
  updateTeam: (id: number, data: NewTeamInput) => request<Team>(`/teams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  getAuthStatus: () => request<{ enabled: boolean }>("/auth/status"),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  registerFirstAdmin: (email: string, realName: string, password: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, realName, password }) }),
  getMe: () => request<AuthUser | null>("/auth/me"),
};

export type ShootFormRow = {
  firstName: string;
  lastName: string;
  ageGroup: string;
  startId: number | null;
  endId: number | null;
  result: number;
};
