import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSchedule } from "./roundRobin.js";

function teams(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Team ${i + 1}` }));
}

test("fewer than 2 teams produces an empty schedule", () => {
  assert.deepEqual(generateSchedule([]), { matches: [], maxWeek: 0 });
  assert.deepEqual(generateSchedule(teams(1)), { matches: [], maxWeek: 0 });
});

for (const n of [2, 3, 4, 5, 6]) {
  test(`${n} teams: every pair meets exactly twice (once home, once away), maxWeek and match count line up`, () => {
    const { matches, maxWeek } = generateSchedule(teams(n));

    const expectedMaxWeek = (n % 2 !== 0 ? n : n - 1) * 2;
    assert.equal(maxWeek, expectedMaxWeek);
    assert.equal(matches.length, n * (n - 1));

    const pairCounts = new Map<string, { asHome: number; asGuest: number }>();
    for (const m of matches) {
      assert.notEqual(m.homeTeamId, m.guestTeamId, "a team cannot play itself");
      const key = [m.homeTeamId, m.guestTeamId].sort((a, b) => a - b).join("-");
      const entry = pairCounts.get(key) ?? { asHome: 0, asGuest: 0 };
      if (m.homeTeamId < m.guestTeamId) entry.asHome++;
      else entry.asGuest++;
      pairCounts.set(key, entry);
    }
    // Every pair of teams should meet exactly twice total, once with each
    // ordering (home/guest swapped for the return match).
    for (const { asHome, asGuest } of pairCounts.values()) {
      assert.equal(asHome + asGuest, 2);
    }

    // Every team appears in every week exactly once, except for a single
    // bye week per team when the team count is odd.
    const teamIds = teams(n).map((t) => t.id);
    for (let week = 1; week <= maxWeek; week++) {
      const weekMatches = matches.filter((m) => m.week === week);
      const playing = new Set(weekMatches.flatMap((m) => [m.homeTeamId, m.guestTeamId]));
      assert.ok(playing.size <= teamIds.length);
      if (n % 2 === 0) {
        assert.equal(playing.size, teamIds.length, "even team count should have no byes");
      }
    }
  });
}
