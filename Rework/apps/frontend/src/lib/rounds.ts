// Hinrunde / Rückrunde split, shared by the Wettkämpfe view toggle.
//
// The round-robin generator lays the Hinrunde in weeks 1..maxWeek/2 and the
// Rückrunde in maxWeek/2+1..maxWeek (see backend roundRobin.ts, which adds
// maxWeekHalf to the return-leg week). So the split is purely a function of
// the week number relative to the highest week in the season - no stored
// flag needed. Matches rescheduled past the original maxWeek (drag-and-drop)
// simply count toward the Rückrunde, which is the sensible default.

export type Round = "hin" | "rueck";

export function roundOfWeek(week: number, maxWeek: number): Round {
  const half = Math.ceil(maxWeek / 2);
  return week <= half ? "hin" : "rueck";
}

export const ROUND_LABEL: Record<Round, string> = {
  hin: "Hinrunde",
  rueck: "Rückrunde",
};
