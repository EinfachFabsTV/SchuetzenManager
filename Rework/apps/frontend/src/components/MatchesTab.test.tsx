import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchesTab } from "./MatchesTab";
import type { Match, SeasonDetail, Shoot } from "../types";
import { theme } from "../theme";

/** jsdom liefert Farben als "rgb(r, g, b)" zurueck, das Theme als Hex. */
function rgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

function shoot(teamSide: "HOME" | "GUEST", result: number): Shoot {
  return {
    id: Math.random(),
    firstName: "test",
    lastName: String(result),
    ageGroup: "Schützenklasse",
    teamSide,
    additional: false,
    startId: null,
    endId: null,
    result,
    matchId: 1,
  };
}

function match(id: number, week: number, home: string, guest: string): Match {
  return {
    id,
    week,
    seasonId: 1,
    homeTeam: { id: id * 10, name: home },
    guestTeam: { id: id * 10 + 1, name: guest },
    shoots: [],
  } as unknown as Match;
}

function season(): SeasonDetail {
  return {
    id: 1,
    year: 2026,
    label: "Test",
    infoBox: null,
    contactMail: null,
    contactPerson: null,
    teams: [],
    matches: [match(1, 1, "A", "B"), match(2, 2, "C", "D")],
    matchDates: [],
  } as unknown as SeasonDetail;
}

function seasonWith(matches: Match[]): SeasonDetail {
  return { ...season(), matches } as SeasonDetail;
}

describe("MatchesTab", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("navigates to Termine and Mannschaften via the quick links", () => {
    const onNavigate = vi.fn();
    render(<MatchesTab season={season()} onMatchSaved={() => {}} onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("button", { name: "Termine festlegen" }));
    expect(onNavigate).toHaveBeenCalledWith("Termine & Info");

    fireEvent.click(screen.getByRole("button", { name: "Mannschaften-Infos" }));
    expect(onNavigate).toHaveBeenCalledWith("Mannschaften");
  });

  it("toggles between week and Hin-/Rückrunde grouping and remembers the choice", () => {
    const { unmount } = render(<MatchesTab season={season()} onMatchSaved={() => {}} onNavigate={() => {}} />);

    // Default: by week, no round headings.
    expect(screen.queryByRole("heading", { name: "Hinrunde" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nach Hin-/Rückrunde" }));
    expect(screen.getByRole("heading", { name: "Hinrunde" })).toBeInTheDocument();
    // maxWeek 2 -> week 2 is Rückrunde.
    expect(screen.getByRole("heading", { name: "Rückrunde" })).toBeInTheDocument();
    unmount();

    // The choice survives a remount (persisted in localStorage).
    render(<MatchesTab season={season()} onMatchSaved={() => {}} onNavigate={() => {}} />);
    expect(screen.getByRole("heading", { name: "Hinrunde" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nach Woche" })).toBeInTheDocument();
  });

  it("still lists every match as a clickable entry", () => {
    render(<MatchesTab season={season()} onMatchSaved={() => {}} onNavigate={() => {}} />);
    expect(screen.getByText("A vs. B")).toBeInTheDocument();
    expect(screen.getByText("C vs. D")).toBeInTheDocument();
  });

  it("zeigt die Ringe beider Mannschaften neben dem Erfassungsstand", () => {
    const full = match(1, 1, "ms3", "ms1");
    full.shoots = [
      ...[352, 423, 523, 562].map((r) => shoot("HOME", r)),
      ...[345, 456, 234, 256].map((r) => shoot("GUEST", r)),
    ];
    render(<MatchesTab season={seasonWith([full])} onMatchSaved={() => {}} onNavigate={() => {}} />);

    expect(screen.getByText("1.860 / 1.291")).toBeInTheDocument();
    expect(screen.getByText("8/8 erfasst")).toBeInTheDocument();
  });

  it("faerbt den Erfassungsstand nach Vollstaendigkeit", () => {
    const shoots = [
      ...[352, 423, 523, 562].map((r) => shoot("HOME", r)),
      ...[345, 456, 234, 256].map((r) => shoot("GUEST", r)),
    ];
    const complete = match(1, 1, "A", "B");
    complete.shoots = shoots;
    const almost = match(2, 1, "C", "D");
    almost.shoots = shoots.slice(0, 6); // 2 fehlen
    const incomplete = match(3, 1, "E", "F");
    incomplete.shoots = shoots.slice(0, 5); // 3 fehlen
    const openMatch = match(4, 1, "G", "H");

    render(<MatchesTab season={seasonWith([complete, almost, incomplete, openMatch])} onMatchSaved={() => {}} onNavigate={() => {}} />);

    const colorOf = (text: string) => getComputedStyle(screen.getByText(text)).color;
    // Die drei Stufen muessen sich unterscheiden - sonst sagt die Ampel nichts.
    expect(colorOf("8/8 erfasst")).toBe(rgb(theme.green));
    expect(colorOf("6/8 erfasst")).toBe(rgb(theme.gold));
    expect(colorOf("5/8 erfasst")).toBe(rgb(theme.danger));
    expect(colorOf("offen")).toBe(rgb(theme.danger));
  });
});
