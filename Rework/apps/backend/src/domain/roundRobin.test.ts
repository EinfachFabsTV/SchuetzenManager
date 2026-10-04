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

// Bis 6 Mannschaften lief der alte Zufallsalgorithmus zuverlaessig, deshalb
// fiel nie auf, dass er sich ab 12 festlief. Die groesseren Zahlen sind
// genau dieser Regressionsschutz.
for (const n of [2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 16, 20, 24]) {
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
      } else {
        // Ungerade Zahl: genau eine Mannschaft pausiert pro Woche.
        assert.equal(playing.size, teamIds.length - 1, `Woche ${week}: ${playing.size} statt ${teamIds.length - 1} Spielende`);
      }
      // Niemand darf in derselben Woche zweimal antreten.
      assert.equal(playing.size, weekMatches.length * 2, `Woche ${week}: eine Mannschaft spielt mehrfach`);
    }
  });

  test(`${n} teams: Heimrecht bleibt ueber die Hinrunde ausgeglichen`, () => {
    const { matches, maxWeek } = generateSchedule(teams(n));
    const half = maxWeek / 2;
    const balance = new Map<number, number>();
    for (const m of matches.filter((x) => x.week <= half)) {
      balance.set(m.homeTeamId, (balance.get(m.homeTeamId) ?? 0) + 1);
      balance.set(m.guestTeamId, (balance.get(m.guestTeamId) ?? 0) - 1);
    }
    for (const [teamId, diff] of balance) {
      // Bei ungerader Spielzahl ist eine Differenz von 1 unvermeidbar, mehr
      // nicht: sonst traete eine Mannschaft deutlich haeufiger daheim oder
      // auswaerts an als die uebrigen.
      assert.ok(Math.abs(diff) <= 1, `Mannschaft ${teamId}: Heim/Gast-Differenz ${diff} in der Hinrunde`);
    }
  });
}

test("ein Spielplan ist nicht jedes Mal derselbe", () => {
  const plan = () => generateSchedule(teams(8)).matches.map((m) => `${m.week}:${m.homeTeamId}-${m.guestTeamId}`).join("|");
  const runs = new Set(Array.from({ length: 10 }, plan));
  assert.ok(runs.size > 1, "zehn Spielplaene waren identisch - die Mischung wirkt nicht");
});
