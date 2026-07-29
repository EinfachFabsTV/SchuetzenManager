import { describe, expect, it, beforeEach } from "vitest";
import { TOUR_STEPS, TOUR_VERSION, getSeenVersion, markStepsDone, markTourSeen, resetTourProgress, stepsToAutoRun } from "./tour";

const startSteps = TOUR_STEPS.filter((s) => s.requires === "start");
const seasonSteps = TOUR_STEPS.filter((s) => s.requires === "season");

describe("tour context gating", () => {
  beforeEach(() => localStorage.clear());

  it("shows only the start steps on a first launch with no season open", () => {
    expect(getSeenVersion()).toBe(0);
    expect(stepsToAutoRun("start")).toHaveLength(startSteps.length);
    // The season steps must NOT fire here - there is nothing to look at yet.
    expect(stepsToAutoRun("start").some((s) => s.requires === "season")).toBe(false);
  });

  it("continues with the season steps once a season is open", () => {
    markStepsDone(startSteps);
    expect(stepsToAutoRun("start")).toHaveLength(0);
    expect(stepsToAutoRun("season")).toHaveLength(seasonSteps.length);
  });

  it("stops auto-running once every step has been seen", () => {
    markStepsDone(TOUR_STEPS);
    expect(getSeenVersion()).toBe(TOUR_VERSION);
    expect(stepsToAutoRun("start")).toHaveLength(0);
    expect(stepsToAutoRun("season")).toHaveLength(0);
  });

  it("does not repeat a segment that was already completed", () => {
    markStepsDone(startSteps);
    markStepsDone(startSteps);
    expect(stepsToAutoRun("start")).toHaveLength(0);
  });

  it("runs nothing after the current version was marked seen", () => {
    markTourSeen();
    expect(stepsToAutoRun("start")).toHaveLength(0);
    expect(stepsToAutoRun("season")).toHaveLength(0);
  });

  it("runs only newer steps after an update", () => {
    const seen = 1;
    const newer = TOUR_STEPS.filter((s) => s.sinceVersion > seen && s.requires === "start");
    expect(stepsToAutoRun("start", seen, [])).toHaveLength(newer.length);
  });

  it("replays everything after resetting progress", () => {
    markStepsDone(TOUR_STEPS);
    resetTourProgress();
    expect(stepsToAutoRun("start")).toHaveLength(startSteps.length);
    expect(stepsToAutoRun("season")).toHaveLength(seasonSteps.length);
  });

  it("every step has a unique id", () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
  });
});
