import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MatchForm } from "./MatchForm";
import { api } from "../api/client";
import type { Match, Team } from "../types";

vi.mock("../api/client", () => ({ api: { saveMatch: vi.fn() } }));

const team = (id: number, name: string): Team => ({
  id,
  name,
  trainingDay: null,
  trainingTime: null,
  location: null,
  contact: null,
  phone: null,
  seasonId: 1,
});

function buildMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 1,
    week: 1,
    seasonId: 1,
    homeTeamId: 1,
    guestTeamId: 2,
    homeTeam: team(1, "Meppen 1"),
    guestTeam: team(2, "Geeste 1"),
    shoots: [],
    ...overrides,
  };
}

function nameInputsInFirstGrid() {
  // The grid header row is "Vorname"/"Nachname"/.../"Ringe"; data rows follow
  // with the same 6-column layout. First column = firstName inputs.
  return Array.from(document.querySelectorAll("div > input")).filter(
    (el) => (el as HTMLInputElement).value !== undefined,
  ) as HTMLInputElement[];
}

describe("MatchForm", () => {
  beforeEach(() => {
    vi.mocked(api.saveMatch).mockReset();
  });

  it("pads empty matches to 4 rows per side with no additional-shooter rows", () => {
    render(<MatchForm match={buildMatch()} onSaved={vi.fn()} onCancel={vi.fn()} />);
    // 6 inputs per row (firstName, lastName, startId, endId, result - select is not an input) * 4 rows * 2 sides = 40
    const perRowTextInputs = 5;
    expect(nameInputsInFirstGrid()).toHaveLength(perRowTextInputs * 4 * 2);
  });

  it("pre-fills existing shoots and preserves them on save", async () => {
    vi.mocked(api.saveMatch).mockResolvedValue(buildMatch());
    const match = buildMatch({
      shoots: [
        {
          id: 1,
          firstName: "Christian",
          lastName: "Kater",
          ageGroup: "Schützenklasse",
          teamSide: "HOME",
          additional: false,
          startId: 10,
          endId: 19,
          result: 380,
          matchId: 1,
        },
      ],
    });

    render(<MatchForm match={match} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByDisplayValue("Christian")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Kater")).toBeInTheDocument();
    expect(screen.getByDisplayValue("380")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(api.saveMatch).toHaveBeenCalled());
    const [, payload] = vi.mocked(api.saveMatch).mock.calls[0];
    expect(payload.homeShoots[0]).toMatchObject({ firstName: "Christian", lastName: "Kater", result: 380, startId: 10, endId: 19 });
  });

  it("converts blank numeric fields to 0/null instead of sending empty strings", async () => {
    vi.mocked(api.saveMatch).mockResolvedValue(buildMatch());
    render(<MatchForm match={buildMatch()} onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(api.saveMatch).toHaveBeenCalled());
    const [, payload] = vi.mocked(api.saveMatch).mock.calls[0];
    expect(payload.homeShoots[0]).toMatchObject({ firstName: "", result: 0, startId: null, endId: null });
  });

  it("adds an additional-shooter row on demand", () => {
    render(<MatchForm match={buildMatch()} onSaved={vi.fn()} onCancel={vi.fn()} />);
    const before = nameInputsInFirstGrid().length;

    fireEvent.click(screen.getAllByRole("button", { name: "+" })[0]);

    expect(nameInputsInFirstGrid().length).toBe(before + 5);
  });

  it("calls onSaved with the backend response and shows an error on failure", async () => {
    vi.mocked(api.saveMatch).mockRejectedValue(new Error("Match nicht gefunden."));
    const onSaved = vi.fn();

    render(<MatchForm match={buildMatch()} onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Match nicht gefunden.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
