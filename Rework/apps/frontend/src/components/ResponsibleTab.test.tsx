import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ResponsibleTab } from "./ResponsibleTab";
import { api } from "../api/client";
import type { Team } from "../types";

vi.mock("../api/client", () => ({
  api: { getResponsible: vi.fn(), getUsers: vi.fn(), addResponsible: vi.fn(), deleteResponsible: vi.fn() },
}));

const teams: Team[] = [
  { id: 10, name: "Meppen 1", trainingDay: null, trainingTime: null, location: null, contact: null, phone: null, seasonId: 1 },
  { id: 11, name: "Geeste 1", trainingDay: null, trainingTime: null, location: null, contact: null, phone: null, seasonId: 1 },
];

const users = [
  { id: 1, email: "a@b.de", realName: "Anna" },
  { id: 2, email: "c@d.de", realName: "Carl" },
];

describe("ResponsibleTab", () => {
  beforeEach(() => {
    vi.mocked(api.getResponsible).mockReset();
    vi.mocked(api.getUsers).mockReset().mockResolvedValue(users);
    vi.mocked(api.addResponsible).mockReset();
    vi.mocked(api.deleteResponsible).mockReset().mockResolvedValue(undefined);
  });

  it("lists existing assignments", async () => {
    vi.mocked(api.getResponsible).mockResolvedValue([
      { id: 100, userId: 1, team: "Meppen 1", email: "a@b.de", realName: "Anna" },
    ]);

    render(<ResponsibleTab seasonId={1} teams={teams} />);

    expect(await screen.findByText("Anna")).toBeInTheDocument();
    // "Meppen 1" also appears as a <select> option, so scope to the table.
    expect(within(screen.getByRole("table")).getByText("Meppen 1")).toBeInTheDocument();
  });

  it("shows an empty-state when there are no assignments", async () => {
    vi.mocked(api.getResponsible).mockResolvedValue([]);

    render(<ResponsibleTab seasonId={1} teams={teams} />);

    expect(await screen.findByText("Noch keine Zuordnungen.")).toBeInTheDocument();
  });

  it("adds an assignment for the selected user and team", async () => {
    vi.mocked(api.getResponsible).mockResolvedValue([]);
    vi.mocked(api.addResponsible).mockResolvedValue({ id: 101, userId: 2, team: "Geeste 1", email: "c@d.de", realName: "Carl" });

    render(<ResponsibleTab seasonId={1} teams={teams} />);
    await screen.findByText("Noch keine Zuordnungen.");
    await waitFor(() => expect(api.getUsers).toHaveBeenCalled());

    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "2" } }); // user Carl
    fireEvent.change(selects[1], { target: { value: "Geeste 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

    await waitFor(() => expect(api.addResponsible).toHaveBeenCalledWith(1, 2, "Geeste 1"));
  });

  it("removes an assignment", async () => {
    vi.mocked(api.getResponsible).mockResolvedValue([
      { id: 100, userId: 1, team: "Meppen 1", email: "a@b.de", realName: "Anna" },
    ]);

    render(<ResponsibleTab seasonId={1} teams={teams} />);
    await screen.findByText("Anna");

    fireEvent.click(screen.getByRole("button", { name: "Entfernen" }));

    await waitFor(() => expect(api.deleteResponsible).toHaveBeenCalledWith(100));
  });

  it("surfaces the backend error on a duplicate assignment", async () => {
    vi.mocked(api.getResponsible).mockResolvedValue([]);
    vi.mocked(api.addResponsible).mockRejectedValue(new Error("Der Benutzer ist dieser Mannschaft bereits zugeordnet."));

    render(<ResponsibleTab seasonId={1} teams={teams} />);
    await screen.findByText("Noch keine Zuordnungen.");

    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

    expect(await screen.findByText("Der Benutzer ist dieser Mannschaft bereits zugeordnet.")).toBeInTheDocument();
  });
});
