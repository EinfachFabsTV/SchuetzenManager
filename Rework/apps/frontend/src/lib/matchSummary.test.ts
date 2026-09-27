import { describe, expect, it } from "vitest";
import type { Match, Shoot } from "../types";
import { formatMatchRings, summarizeMatch } from "./matchSummary";

function shoot(teamSide: "HOME" | "GUEST", result: number, additional = false): Shoot {
  return {
    id: Math.random(),
    firstName: "test",
    lastName: String(result),
    ageGroup: "Schützenklasse",
    teamSide,
    additional,
    startId: null,
    endId: null,
    result,
    matchId: 1,
  };
}

function match(shoots: Shoot[]): Match {
  return {
    id: 1,
    week: 1,
    seasonId: 1,
    homeTeam: { id: 1, name: "ms3", seasonId: 1 },
    guestTeam: { id: 2, name: "ms1", seasonId: 1 },
    shoots,
  } as unknown as Match;
}

// Die Zahlen aus dem gemeldeten Fall: ms3 352/423/523/562, ms1 345/456/234/256.
const FULL = match([
  ...[352, 423, 523, 562].map((r) => shoot("HOME", r)),
  ...[345, 456, 234, 256].map((r) => shoot("GUEST", r)),
]);

describe("summarizeMatch", () => {
  it("wertet wie Tabelle und PDF nur die besten drei Schützen", () => {
    const s = summarizeMatch(FULL);
    // 562 + 523 + 423, der schwächste (352) fällt raus.
    expect(s.homeRings).toBe(1508);
    // 456 + 345 + 256, ohne die 234.
    expect(s.guestRings).toBe(1057);
    expect(formatMatchRings(s)).toBe("1.508 / 1.057");
  });

  it("zählt bei weniger als drei Ergebnissen alle vorhandenen", () => {
    const s = summarizeMatch(match([shoot("HOME", 352), shoot("HOME", 423)]));
    expect(s.homeRings).toBe(775);
  });

  it("zählt Ersatzschützen weder im Stand noch in den Ringen mit", () => {
    // Der Ersatzschütze wäre mit 999 der beste - er darf trotzdem nicht zählen.
    const s = summarizeMatch(match([...FULL.shoots, shoot("HOME", 999, true)]));
    expect(s.recorded).toBe(8);
    expect(s.homeRings).toBe(1508);
  });

  it("ist grün, sobald alle acht Ergebnisse stehen", () => {
    const s = summarizeMatch(FULL);
    expect(s.tone).toBe("complete");
    expect(s.label).toBe("8/8 erfasst");
  });

  it.each([1, 2])("ist orange, wenn %i Ergebnis(se) fehlen", (missing) => {
    const s = summarizeMatch(match(FULL.shoots.slice(0, 8 - missing)));
    expect(s.missing).toBe(missing);
    expect(s.tone).toBe("almost");
  });

  it("ist rot, wenn mehr als zwei Ergebnisse fehlen", () => {
    expect(summarizeMatch(match(FULL.shoots.slice(0, 5))).tone).toBe("incomplete");
  });

  it("ist rot und ohne Ringe, solange nichts erfasst ist", () => {
    const s = summarizeMatch(match([]));
    expect(s.tone).toBe("incomplete");
    expect(s.label).toBe("offen");
    expect(formatMatchRings(s)).toBeNull();
  });
});
