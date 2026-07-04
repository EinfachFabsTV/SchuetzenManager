// End-to-end route tests via Fastify's .inject() (no real network port,
// no separately-running server needed). Complements src/domain/*.test.ts,
// which only covers the pure logic - this exercises the actual HTTP layer
// (auth guarding, request parsing, status codes) where e.g. the
// Content-Type-on-bodyless-DELETE bug (see TECHNICAL.md) lived undetected
// by the domain tests. One flowing scenario instead of isolated cases,
// mirroring the exact manual curl verification flow used throughout
// development: register -> create season -> edit team -> save a match
// result -> check the table -> change password -> delete the season.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const testDbDir = mkdtempSync(path.join(tmpdir(), "schuetzenmanager-test-"));
process.env.DATABASE_URL = `file:${path.join(testDbDir, "test.db")}`;
process.env.AUTH_ENABLED = "true";
process.env.JWT_SECRET = "test-secret";

execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });

const { buildApp } = await import("./app.js");
const { prisma } = await import("./db.js");

let app: Awaited<ReturnType<typeof buildApp>>;

before(async () => {
  app = await buildApp({ logger: false });
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
  rmSync(testDbDir, { recursive: true, force: true });
});

let token: string;
let seasonId: number;
let teamId: number;
let matchId: number;

test("CORS preflight from the desktop (Tauri) origin is allowed", async () => {
  // Regression guard for the desktop "Failed to fetch" bug: a cross-origin
  // non-simple request (POST/PUT/DELETE) triggers an OPTIONS preflight, and
  // without CORS the browser blocks it before any handler runs. The Vite
  // proxy used in the web test is same-origin, so only this inject-level
  // check catches it.
  const res = await app.inject({
    method: "OPTIONS",
    url: "/api/seasons",
    headers: {
      origin: "http://tauri.localhost",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  assert.ok(res.statusCode < 400, `preflight status ${res.statusCode}`);
  assert.equal(res.headers["access-control-allow-origin"], "http://tauri.localhost");
});

test("writes are blocked without a token", async () => {
  const res = await app.inject({ method: "POST", url: "/api/seasons", payload: { year: 2026, label: "x", teams: [] } });
  assert.equal(res.statusCode, 401);
});

test("bootstrap registration issues a token", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "admin@example.com", realName: "Admin", password: "geheim123" },
  });
  assert.equal(res.statusCode, 201);
  token = res.json().token;
  assert.ok(token);
});

test("a second registration attempt is rejected", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { email: "other@example.com", realName: "Other", password: "geheim123" },
  });
  assert.equal(res.statusCode, 403);
});

test("creates a season with a generated schedule", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/seasons",
    headers: { authorization: `Bearer ${token}` },
    payload: { year: 2026, label: "Integrationstest", teams: [{ name: "Meppen 1" }, { name: "Geeste 1" }] },
  });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  seasonId = body.id;
  teamId = body.teams.find((t: { name: string }) => t.name === "Meppen 1").id;
  assert.equal(body.teams.length, 2);
});

test("GET /api/seasons is public (no token needed)", async () => {
  const res = await app.inject({ method: "GET", url: "/api/seasons" });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().some((s: { id: number }) => s.id === seasonId));
});

test("renaming a team works and rejects duplicate names", async () => {
  const res = await app.inject({
    method: "PUT",
    url: `/api/teams/${teamId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Meppen 1 (SG)" },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().name, "Meppen 1 (SG)");

  const dupe = await app.inject({
    method: "PUT",
    url: `/api/teams/${teamId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Geeste 1" },
  });
  assert.equal(dupe.statusCode, 409);
});

test("saving a match result updates the table", async () => {
  const season = (await app.inject({ method: "GET", url: `/api/seasons/${seasonId}` })).json();
  matchId = season.matches[0].id;

  const save = await app.inject({
    method: "PUT",
    url: `/api/matches/${matchId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      homeShoots: [{ firstName: "Christian", lastName: "Kater", ageGroup: "Schützenklasse", result: 380 }],
      guestShoots: [{ firstName: "Peter", lastName: "Kramer", ageGroup: "Senioren", result: 300 }],
    },
  });
  assert.equal(save.statusCode, 200);

  const table = (await app.inject({ method: "GET", url: `/api/seasons/${seasonId}/table` })).json();
  const winner = table.find((r: { rings: number }) => r.rings === 380);
  assert.ok(winner);
  assert.equal(winner.win, 1);
  assert.equal(winner.points, 2);
});

test("rescheduling a match to a different week persists it", async () => {
  const move = await app.inject({
    method: "PATCH",
    url: `/api/matches/${matchId}/week`,
    headers: { authorization: `Bearer ${token}` },
    payload: { week: 2 },
  });
  assert.equal(move.statusCode, 200);
  assert.equal(move.json().week, 2);

  const invalid = await app.inject({
    method: "PATCH",
    url: `/api/matches/${matchId}/week`,
    headers: { authorization: `Bearer ${token}` },
    payload: { week: 0 },
  });
  assert.equal(invalid.statusCode, 400);
});

test("personal scores reflect the saved shoot", async () => {
  const scores = (await app.inject({ method: "GET", url: `/api/seasons/${seasonId}/personal-scores` })).json();
  assert.ok(scores.some((s: { shooter: string; total: number }) => s.shooter === "Christian Kater" && s.total === 380));
});

test("PDF export returns a valid PDF", async () => {
  const res = await app.inject({ method: "GET", url: `/api/seasons/${seasonId}/pdf` });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "application/pdf");
  assert.equal(res.rawPayload.subarray(0, 5).toString(), "%PDF-");
});

test("changing the password with the wrong current password fails", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/change-password",
    headers: { authorization: `Bearer ${token}` },
    payload: { currentPassword: "falsch", newPassword: "neuespasswort123" },
  });
  assert.equal(res.statusCode, 401);
});

test("changing the password works and the old password stops logging in", async () => {
  const change = await app.inject({
    method: "POST",
    url: "/api/auth/change-password",
    headers: { authorization: `Bearer ${token}` },
    payload: { currentPassword: "geheim123", newPassword: "neuespasswort123" },
  });
  assert.equal(change.statusCode, 200);

  const oldLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@example.com", password: "geheim123" },
  });
  assert.equal(oldLogin.statusCode, 401);

  const newLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@example.com", password: "neuespasswort123" },
  });
  assert.equal(newLogin.statusCode, 200);
});

test("creating a user is blocked without a token", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    payload: { email: "member@example.com", realName: "Vereinsmitglied" },
  });
  assert.equal(res.statusCode, 401);
});

test("creating a user generates a password, mails it (jsonTransport, no SMTP configured), and never returns the hash", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${token}` },
    payload: { email: "member@example.com", realName: "Vereinsmitglied" },
  });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.email, "member@example.com");
  assert.equal(body.password, undefined);

  const user = await prisma.user.findUnique({ where: { email: "member@example.com" } });
  assert.ok(user);
  assert.notEqual(user.password, "");
});

test("creating a user with an already-registered email is rejected", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${token}` },
    payload: { email: "member@example.com", realName: "Zweiter Versuch" },
  });
  assert.equal(res.statusCode, 409);
});

test("listing users requires a token and never exposes password hashes", async () => {
  const unauth = await app.inject({ method: "GET", url: "/api/users" });
  assert.equal(unauth.statusCode, 401);

  const res = await app.inject({ method: "GET", url: "/api/users", headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.statusCode, 200);
  const users = res.json();
  assert.ok(users.some((u: { email: string }) => u.email === "member@example.com"));
  assert.ok(users.every((u: Record<string, unknown>) => !("password" in u)));
});

test("updating season info persists infoBox/contactMail/contactPerson", async () => {
  const res = await app.inject({
    method: "PUT",
    url: `/api/seasons/${seasonId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { infoBox: "Hinweistext", contactMail: "kontakt@example.com", contactPerson: "Max Muster" },
  });
  assert.equal(res.statusCode, 200);

  const season = (await app.inject({ method: "GET", url: `/api/seasons/${seasonId}` })).json();
  assert.equal(season.infoBox, "Hinweistext");
  assert.equal(season.contactMail, "kontakt@example.com");
  assert.equal(season.contactPerson, "Max Muster");
});

test("updating season info is blocked without a token", async () => {
  const res = await app.inject({
    method: "PUT",
    url: `/api/seasons/${seasonId}`,
    payload: { infoBox: "x" },
  });
  assert.equal(res.statusCode, 401);
});

test("assigning dates to weeks upserts them and is reflected in the season", async () => {
  const res = await app.inject({
    method: "PUT",
    url: `/api/seasons/${seasonId}/dates`,
    headers: { authorization: `Bearer ${token}` },
    payload: { dates: [{ week: 1, date: "2026-03-15" }, { week: 2, date: null }] },
  });
  assert.equal(res.statusCode, 200);

  const season = (await app.inject({ method: "GET", url: `/api/seasons/${seasonId}` })).json();
  const week1 = season.matchDates.find((d: { week: number }) => d.week === 1);
  assert.equal(week1.date, "2026-03-15");
});

test("assigning a responsible user to a team, rejecting duplicates, then removing it", async () => {
  const member = await prisma.user.findUnique({ where: { email: "member@example.com" } });
  assert.ok(member);

  const create = await app.inject({
    method: "POST",
    url: `/api/seasons/${seasonId}/responsible`,
    headers: { authorization: `Bearer ${token}` },
    payload: { userId: member.id, team: "Geeste 1" },
  });
  assert.equal(create.statusCode, 201);
  const responsibleId = create.json().id;
  assert.equal(create.json().email, "member@example.com");

  const list = (await app.inject({ method: "GET", url: `/api/seasons/${seasonId}/responsible`, headers: { authorization: `Bearer ${token}` } })).json();
  assert.ok(list.some((r: { id: number; team: string }) => r.id === responsibleId && r.team === "Geeste 1"));

  const dupe = await app.inject({
    method: "POST",
    url: `/api/seasons/${seasonId}/responsible`,
    headers: { authorization: `Bearer ${token}` },
    payload: { userId: member.id, team: "Geeste 1" },
  });
  assert.equal(dupe.statusCode, 409);

  const del = await app.inject({ method: "DELETE", url: `/api/responsible/${responsibleId}`, headers: { authorization: `Bearer ${token}` } });
  assert.equal(del.statusCode, 204);
});

test("resetting a user's password changes the stored hash", async () => {
  const before = await prisma.user.findUnique({ where: { email: "member@example.com" } });
  assert.ok(before);

  const res = await app.inject({
    method: "POST",
    url: `/api/users/${before.id}/reset-password`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 200);

  const after = await prisma.user.findUnique({ where: { email: "member@example.com" } });
  assert.notEqual(after!.password, before.password);
});

test("deleting a user removes them from the list", async () => {
  const member = await prisma.user.findUnique({ where: { email: "member@example.com" } });
  assert.ok(member);

  const res = await app.inject({ method: "DELETE", url: `/api/users/${member.id}`, headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.statusCode, 204);

  const users = (await app.inject({ method: "GET", url: "/api/users", headers: { authorization: `Bearer ${token}` } })).json();
  assert.ok(!users.some((u: { email: string }) => u.email === "member@example.com"));
});

test("deleting the season removes it (DELETE without a body must not 400)", async () => {
  const res = await app.inject({
    method: "DELETE",
    url: `/api/seasons/${seasonId}`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.statusCode, 204);

  const list = (await app.inject({ method: "GET", url: "/api/seasons" })).json();
  assert.ok(!list.some((s: { id: number }) => s.id === seasonId));
});
