import { test } from "node:test";
import assert from "node:assert/strict";
import { computePersonalScores } from "./personalScores.js";

const teamNames = new Map([
  [1, "Meppen 1"],
  [2, "Geeste 1"],
]);

function shoot(teamSide: "HOME" | "GUEST", firstName: string, lastName: string, result: number, ageGroup = "Schützenklasse") {
  return { teamSide, firstName, lastName, ageGroup, result };
}

test("sums a shooter's results across multiple matches", () => {
  const rows = computePersonalScores(
    [
      { homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", "Christian", "Kater", 382)] },
      { homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", "Christian", "Kater", 370)] },
    ],
    teamNames,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 752);
});

test("mean divides by weeks with a non-zero result, not total weeks played", () => {
  const rows = computePersonalScores(
    [
      { homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", "Christian", "Kater", 380)] },
      { homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", "Christian", "Kater", 0)] },
      { homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", "Christian", "Kater", 360)] },
    ],
    teamNames,
  );
  assert.equal(rows[0].total, 740);
  assert.equal(rows[0].mean, 370); // (380+360)/2 active weeks, not /3
});

test("shooters who never scored are dropped entirely", () => {
  const rows = computePersonalScores(
    [{ homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", "", "", 0)] }],
    teamNames,
  );
  assert.equal(rows.length, 0);
});

test("resolves team side to the actual team name via the id map", () => {
  const rows = computePersonalScores(
    [{ homeTeamId: 1, guestTeamId: 2, shoots: [shoot("GUEST", "Peter", "Kramer", 355)] }],
    teamNames,
  );
  assert.equal(rows[0].team, "Geeste 1");
});

test("same shooter name in different age groups is tracked separately", () => {
  const rows = computePersonalScores(
    [
      { homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", "A", "B", 300, "Schützenklasse")] },
      { homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", "A", "B", 250, "Senioren")] },
    ],
    teamNames,
  );
  assert.equal(rows.length, 2);
});

test("sorts by total desc, then mean desc, then shooter name asc", () => {
  const rows = computePersonalScores(
    [
      { homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", "Bea", "Z", 300)] },
      { homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", "Anna", "Y", 300)] },
    ],
    teamNames,
  );
  assert.deepEqual(
    rows.map((r) => r.shooter),
    ["Anna Y", "Bea Z"],
  );
});
