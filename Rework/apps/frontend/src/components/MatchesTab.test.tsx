import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchesTab } from "./MatchesTab";
import type { Match, SeasonDetail } from "../types";

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
});
