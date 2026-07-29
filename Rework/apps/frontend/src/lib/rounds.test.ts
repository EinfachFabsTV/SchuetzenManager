import { describe, expect, it } from "vitest";
import { roundOfWeek } from "./rounds";

describe("roundOfWeek", () => {
  it("splits a 10-week season (6 teams) at the halfway point", () => {
    // maxWeek 10 -> Hinrunde weeks 1..5, Rückrunde 6..10.
    for (let w = 1; w <= 5; w++) expect(roundOfWeek(w, 10)).toBe("hin");
    for (let w = 6; w <= 10; w++) expect(roundOfWeek(w, 10)).toBe("rueck");
  });

  it("counts weeks rescheduled past maxWeek toward the Rückrunde", () => {
    expect(roundOfWeek(11, 10)).toBe("rueck");
  });

  it("handles an odd maxWeek by rounding the Hinrunde up", () => {
    // maxWeek 5 -> half = 3: weeks 1..3 hin, 4..5 rück.
    expect(roundOfWeek(3, 5)).toBe("hin");
    expect(roundOfWeek(4, 5)).toBe("rueck");
  });
});
