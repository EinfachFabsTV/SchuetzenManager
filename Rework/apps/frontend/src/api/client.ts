import type { Match, MatchDate, PersonalScoreRow, Responsible, SeasonDetail, SeasonSummary, TableRow, Team } from "../types";

const TOKEN_KEY = "schuetzenmanager_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Relative "/api" works when the backend serves the frontend itself
// (Vite dev proxy, or the same-origin Docker/hosted deployment - see
// server.ts). Inside the Tauri desktop app, the frontend is loaded from
// Tauri's own webview origin, not from the backend's HTTP server, so
// requests have to target the sidecar backend explicitly instead -
// see TECHNICAL.md's "Tauri-Sidecar" section for why.
const API_BASE = "__TAURI_INTERNALS__" in window ? "http://localhost:3001/api" : "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      // Fastify 5 rejects a request that declares Content-Type: application/json
      // but has no body (e.g. DELETE calls) with a 400 FST_ERR_CTP_EMPTY_JSON_BODY.
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API-Fehler ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
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
  deleteSeason: (id: number) => request<void>(`/seasons/${id}`, { method: "DELETE" }),
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
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  getUsers: () => request<AuthUser[]>("/users"),
  createUser: (email: string, realName: string) =>
    request<AuthUser>("/users", { method: "POST", body: JSON.stringify({ email, realName }) }),
  deleteUser: (id: number) => request<void>(`/users/${id}`, { method: "DELETE" }),
  resetUserPassword: (id: number) => request<{ ok: true }>(`/users/${id}/reset-password`, { method: "POST" }),
  updateSeasonInfo: (id: number, data: { infoBox?: string | null; contactMail?: string | null; contactPerson?: string | null }) =>
    request<SeasonDetail>(`/seasons/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateDates: (id: number, dates: { week: number; date: string | null }[]) =>
    request<MatchDate[]>(`/seasons/${id}/dates`, { method: "PUT", body: JSON.stringify({ dates }) }),
  getResponsible: (seasonId: number) => request<Responsible[]>(`/seasons/${seasonId}/responsible`),
  addResponsible: (seasonId: number, userId: number, team: string) =>
    request<Responsible>(`/seasons/${seasonId}/responsible`, { method: "POST", body: JSON.stringify({ userId, team }) }),
  deleteResponsible: (id: number) => request<void>(`/responsible/${id}`, { method: "DELETE" }),
};

export type ShootFormRow = {
  firstName: string;
  lastName: string;
  ageGroup: string;
  startId: number | null;
  endId: number | null;
  result: number;
};
