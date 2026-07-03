import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DatesInfoTab } from "./DatesInfoTab";
import { api } from "../api/client";
import type { SeasonDetail } from "../types";

vi.mock("../api/client", () => ({ api: { updateDates: vi.fn(), updateSeasonInfo: vi.fn() } }));

const season: SeasonDetail = {
  id: 1,
  year: 2026,
  label: "Test",
  infoBox: "alter Text",
  contactMail: "a@b.de",
  contactPerson: "Max",
  teams: [],
  matches: [],
  matchDates: [
    { id: 1, week: 1, date: "2026-03-15", seasonId: 1 },
    { id: 2, week: 2, date: null, seasonId: 1 },
  ],
};

describe("DatesInfoTab", () => {
  beforeEach(() => {
    vi.mocked(api.updateDates).mockReset().mockResolvedValue([]);
    vi.mocked(api.updateSeasonInfo).mockReset().mockResolvedValue(season);
  });

  it("pre-fills one date input per week and the info fields", () => {
    render(<DatesInfoTab season={season} onUpdated={vi.fn()} />);

    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
    expect((dateInputs[0] as HTMLInputElement).value).toBe("2026-03-15");
    expect(screen.getByDisplayValue("Max")).toBeInTheDocument();
    expect(screen.getByDisplayValue("a@b.de")).toBeInTheDocument();
    expect(screen.getByDisplayValue("alter Text")).toBeInTheDocument();
  });

  it("saves all weeks (edited value included, empty week as null)", async () => {
    render(<DatesInfoTab season={season} onUpdated={vi.fn()} />);

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[1], { target: { value: "2026-03-22" } });
    fireEvent.click(screen.getByRole("button", { name: "Termine speichern" }));

    await waitFor(() =>
      expect(api.updateDates).toHaveBeenCalledWith(1, [
        { week: 1, date: "2026-03-15" },
        { week: 2, date: "2026-03-22" },
      ]),
    );
    expect(await screen.findByText("Termine gespeichert.")).toBeInTheDocument();
  });

  it("saves the info fields", async () => {
    render(<DatesInfoTab season={season} onUpdated={vi.fn()} />);

    fireEvent.change(screen.getByDisplayValue("Max"), { target: { value: "Erika" } });
    fireEvent.click(screen.getByRole("button", { name: "Angaben speichern" }));

    await waitFor(() =>
      expect(api.updateSeasonInfo).toHaveBeenCalledWith(1, {
        infoBox: "alter Text",
        contactPerson: "Erika",
        contactMail: "a@b.de",
      }),
    );
    expect(await screen.findByText("Angaben gespeichert.")).toBeInTheDocument();
  });
});
