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
