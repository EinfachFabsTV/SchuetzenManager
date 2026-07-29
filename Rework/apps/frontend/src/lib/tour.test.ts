import { describe, expect, it, beforeEach } from "vitest";
import { TOUR_STEPS, TOUR_VERSION, getSeenVersion, markTourSeen, stepsToAutoRun } from "./tour";

describe("tour versioning", () => {
  beforeEach(() => localStorage.clear());

  it("runs the whole tour on a first launch (nothing seen yet)", () => {
    expect(getSeenVersion()).toBe(0);
    expect(stepsToAutoRun()).toHaveLength(TOUR_STEPS.length);
  });

  it("runs nothing after the current version has been seen", () => {
    markTourSeen();
    expect(getSeenVersion()).toBe(TOUR_VERSION);
    expect(stepsToAutoRun()).toHaveLength(0);
  });

  it("runs only newer steps after an update", () => {
    // Pretend the user has seen version 1; a hypothetical v2 step should be
    // the only thing that auto-runs.
    const seen = 1;
    const newerSteps = TOUR_STEPS.filter((s) => s.sinceVersion > seen);
    expect(stepsToAutoRun(seen)).toHaveLength(newerSteps.length);
  });
});
